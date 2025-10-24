// backend/routes/admin/foods.js
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");

const router = express.Router();
const Food = require("../../models/food");
const isAdmin = require("../../middleware/isAdmin");
const {
  PICTOGRAMS,
  ALLERGENS,
  ADDITIVES,
} = require("../../shared/constants/meta");
const { derivePictogramsFromAllergens } = require("../../shared/utils/derivePictograms");

// ──────────────────────────────────────────────────────────────────────────────
// Admin guard
// ──────────────────────────────────────────────────────────────────────────────
router.use(isAdmin);

// ──────────────────────────────────────────────────────────────────────────────
// Utilities
// ──────────────────────────────────────────────────────────────────────────────
function safeFoodQuery(idOrString) {
  if (!idOrString) return {};
  if (mongoose.Types.ObjectId.isValid(idOrString)) {
    return { $or: [{ _id: idOrString }, { id: Number(idOrString) || idOrString }] };
  }
  const asNum = Number(idOrString);
  if (!Number.isNaN(asNum)) return { id: asNum };
  return { id: idOrString };
}

function parseArray(val) {
  if (val == null) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed;
    } catch (_) {
      return s.split(",").map((v) => v.trim()).filter(Boolean);
    }
  }
  return [];
}

function parseBool(v) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return /^(1|true|yes|on)$/i.test(v);
  return false;
}

const VALID_PICTOGRAMS = new Set(PICTOGRAMS.map((p) => p.key));
const VALID_ALLERGENS = new Set(ALLERGENS.map((a) => a.code));
const VALID_ADDITIVES = new Set(ADDITIVES.map((a) => a.code));

function sanitizeCodes(values, allowed) {
  return Array.from(
    new Set(
      parseArray(values)
        .map((val) => String(val).trim())
        .filter((val) => val && (!allowed || allowed.has(val)))
    )
  );
}

function extractPictogramsFromFlags(body, prefix = "contains_") {
  const selected = [];
  PICTOGRAMS.forEach(({ key }) => {
    const field = `${prefix}${key}`;
    if (field in body && parseBool(body[field])) {
      selected.push(key);
    }
  });
  return selected;
}

// ──────────────────────────────────────────────────────────────────────────────
// Multer memory storage
// ──────────────────────────────────────────────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage() });

// ──────────────────────────────────────────────────────────────────────────────
// GET /admin/foods → list
// ──────────────────────────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const { q } = req.query;
    const filter = {};
    if (q && String(q).trim()) {
      const rx = new RegExp(String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [
        { "translations.en.dish": rx },
        { "translations.en.category": rx },
        { "translations.en.description": rx },
        { barcode: rx },
      ];
    }
    const foods = await Food.find(filter).sort({ id: -1 }).lean({ virtuals: true });
    foods.forEach((f) => delete f.image);
    res.json(foods);
  } catch (e) {
    console.error("GET /admin/foods error:", e);
    res.status(500).json({ message: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /admin/foods/:id/image
// ──────────────────────────────────────────────────────────────────────────────
router.get("/:id/image", async (req, res) => {
  try {
    // ⚠️ No `.lean()` — keep Buffer intact
    const food = await Food.findOne(safeFoodQuery(req.params.id));
    if (!food || !food.image?.data) {
      return res.status(404).send("Image not found");
    }

    res.setHeader("Content-Type", food.image.contentType || "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(food.image.data);
  } catch (e) {
    console.error("Image retrieval error:", e);
    res.status(500).send("Error retrieving image");
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /admin/foods → create new food
// ──────────────────────────────────────────────────────────────────────────────
router.post("/", upload.single("image"), async (req, res) => {
  try {
    const {
      barcode,
      date,
      category,
      dish,
      description,
      additives,
      allergens,
      pictograms,
      diabeticFriendly,
    } = req.body;

    if (!barcode || !date || !category || !dish || typeof diabeticFriendly === "undefined") {
      return res.status(400).json({
        message: "Missing required fields (barcode, date, category, dish, diabeticFriendly)",
      });
    }

    // Parse multilingual translations if provided
    let translations = {};
    try {
      if (req.body.translations) {
        const parsed = JSON.parse(req.body.translations);
        if (typeof parsed === "object") translations = parsed;
      }
    } catch (e) {
      console.warn("Invalid translations JSON:", e);
    }

    // Auto-generate next numeric id
    const lastFood = await Food.findOne().sort({ id: -1 }).lean({ virtuals: true });
    const numericId = (lastFood?.id || 0) + 1;

    const normalizedAllergens = sanitizeCodes(allergens, VALID_ALLERGENS);
    const providedPictograms = sanitizeCodes(pictograms, VALID_PICTOGRAMS);
    const flagPictograms = extractPictogramsFromFlags(req.body);
    const derivedFromAllergens = derivePictogramsFromAllergens(
      normalizedAllergens,
      PICTOGRAMS
    );

    const combinedPictograms = Array.from(
      new Set([...providedPictograms, ...flagPictograms, ...derivedFromAllergens])
    );

    const doc = new Food({
      id: numericId,
      barcode: String(barcode),
      date: String(date),
      category: String(category),
      dish: String(dish),
      description: description ?? null,
      translations,
      additives: sanitizeCodes(additives, VALID_ADDITIVES),
      allergens: normalizedAllergens,
      pictograms: combinedPictograms,
      diabeticFriendly: parseBool(diabeticFriendly),
    });

    if (req.file) {
      doc.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype || "image/png",
      };
    }

    await doc.save();
    res.status(201).json(doc);
  } catch (e) {
    console.error("Food upload error:", e);
    res.status(500).json({ message: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /admin/foods/:id → update existing food
// ──────────────────────────────────────────────────────────────────────────────
router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const q = safeFoodQuery(req.params.id);
    const body = { ...req.body };
    const updates = {};

    if (typeof body.barcode !== "undefined") updates.barcode = String(body.barcode);
    if (typeof body.date !== "undefined") updates.date = String(body.date);
    if (typeof body.category !== "undefined") updates.category = String(body.category);
    if (typeof body.dish !== "undefined") updates.dish = String(body.dish);
    if (typeof body.description !== "undefined")
      updates.description = body.description ?? null;

    // Parse translations if provided
    try {
      if (body.translations && typeof body.translations === "string") {
        const parsed = JSON.parse(body.translations);
        if (typeof parsed === "object") updates.translations = parsed;
      } else if (body.translations && typeof body.translations === "object") {
        updates.translations = body.translations;
      }
    } catch (e) {
      console.warn("Invalid translations JSON:", e);
    }

    if (body.diabeticFriendly != null)
      updates.diabeticFriendly = parseBool(body.diabeticFriendly);

    if (body.additives != null)
      updates.additives = sanitizeCodes(body.additives, VALID_ADDITIVES);

    let normalizedAllergens;
    if (body.allergens != null) {
      normalizedAllergens = sanitizeCodes(body.allergens, VALID_ALLERGENS);
      updates.allergens = normalizedAllergens;
    }

    let normalizedPictograms = null;
    if (body.pictograms != null)
      normalizedPictograms = sanitizeCodes(body.pictograms, VALID_PICTOGRAMS);

    const flagPictograms = extractPictogramsFromFlags(body);

    if (normalizedAllergens) {
      const derived = derivePictogramsFromAllergens(normalizedAllergens, PICTOGRAMS);
      normalizedPictograms = [
        ...(normalizedPictograms || []),
        ...derived,
      ];
    }

    if (flagPictograms.length) {
      normalizedPictograms = [
        ...(normalizedPictograms || []),
        ...flagPictograms,
      ];
    }

    if (normalizedPictograms) {
      updates.pictograms = Array.from(new Set(normalizedPictograms));
    }

    if (req.file) {
      updates.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype || "image/png",
      };
    }

    const updated = await Food.findOneAndUpdate(q, updates, { new: true });
    if (!updated) return res.status(404).json({ message: "Food not found" });
    res.json(updated);
  } catch (e) {
    console.error("Food update error:", e);
    res.status(500).json({ message: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /admin/foods/:id
// ──────────────────────────────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Food.findOneAndDelete(safeFoodQuery(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Food not found" });
    res.json({ success: true, message: "Food deleted", deleted });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /admin/foods/bulk-delete
// ──────────────────────────────────────────────────────────────────────────────
router.post("/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "Provide ids: []" });
    }

    const or = ids.map((v) => {
      if (mongoose.Types.ObjectId.isValid(v)) return { _id: v };
      const asNum = Number(v);
      if (!Number.isNaN(asNum)) return { id: asNum };
      return { id: v };
    });

    const result = await Food.deleteMany({ $or: or });
    res.json({ success: true, deletedCount: result.deletedCount || 0 });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
