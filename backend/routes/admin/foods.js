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
} = require("../../../shared/constants/meta");
const { derivePictogramsFromAllergens } = require("../../../shared/utils/derivePictograms");

const VALID_PICTOGRAMS = new Set(PICTOGRAMS.map((p) => p.key));
const VALID_ALLERGENS = new Set(ALLERGENS.map((a) => a.code));
const VALID_ADDITIVES = new Set(ADDITIVES.map((a) => a.code));

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

function sanitizeCodes(values, validSet) {
  if (!Array.isArray(values)) return [];
  const result = [];
  values.forEach((value) => {
    if (value == null) return;
    const normalized = typeof value === "string" ? value : String(value);
    const trimmed = normalized.trim();
    if (trimmed && validSet.has(trimmed) && !result.includes(trimmed)) {
      result.push(trimmed);
    }
  });
  return result;
}

function legacyPictogramFlags(source) {
  if (!source) return [];
  const keys = [];
  PICTOGRAMS.forEach(({ key }) => {
    const flagKey = `contains_${key}`;
    if (flagKey in source && parseBool(source[flagKey])) {
      keys.push(key);
    }
  });
  return keys;
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
    const { barcode, date, category, dish, description, diabeticFriendly } = req.body;

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
        if (parsed && typeof parsed === "object") translations = parsed;
      }
    } catch (e) {
      console.warn("Invalid translations JSON:", e);
    }

    const providedAllergens = sanitizeCodes(parseArray(req.body.allergens), VALID_ALLERGENS);
    const providedAdditives = sanitizeCodes(parseArray(req.body.additives), VALID_ADDITIVES);
    const providedPictograms = sanitizeCodes(parseArray(req.body.pictograms), VALID_PICTOGRAMS);
    const legacyFlags = legacyPictogramFlags(req.body);
    const derivedFromAllergens = derivePictogramsFromAllergens(providedAllergens, PICTOGRAMS);
    const allPictograms = Array.from(
      new Set([...providedPictograms, ...legacyFlags, ...derivedFromAllergens])
    );

    // Auto-generate next numeric id
    const lastFood = await Food.findOne().sort({ id: -1 }).lean();
    const numericId = (lastFood?.id || 0) + 1;

    const doc = new Food({
      id: numericId,
      barcode: String(barcode),
      date: String(date),
      category: String(category),
      dish: String(dish),
      description: description ?? null,
      translations,
      additives: providedAdditives,
      allergens: providedAllergens,
      pictograms: allPictograms,
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

    // Parse translations if provided
    try {
      if (body.translations && typeof body.translations === "string") {
        const parsed = JSON.parse(body.translations);
        if (typeof parsed === "object") body.translations = parsed;
      }
    } catch (e) {
      console.warn("Invalid translations JSON:", e);
    }

    if (body.diabeticFriendly != null)
      body.diabeticFriendly = parseBool(body.diabeticFriendly);

    let pictogramSet = null;

    if (body.additives != null)
      body.additives = sanitizeCodes(parseArray(body.additives), VALID_ADDITIVES);
    if (body.allergens != null) {
      body.allergens = sanitizeCodes(parseArray(body.allergens), VALID_ALLERGENS);
      if (body.allergens.length) {
        pictogramSet = pictogramSet || new Set();
        derivePictogramsFromAllergens(body.allergens, PICTOGRAMS).forEach((key) =>
          pictogramSet.add(key)
        );
      }
    }
    if (body.pictograms != null) {
      const provided = sanitizeCodes(parseArray(body.pictograms), VALID_PICTOGRAMS);
      pictogramSet = pictogramSet || new Set();
      provided.forEach((key) => pictogramSet.add(key));
    }

    const legacy = legacyPictogramFlags(body);
    if (legacy.length) {
      pictogramSet = pictogramSet || new Set();
      legacy.forEach((key) => pictogramSet.add(key));
    }

    if (pictogramSet !== null) {
      body.pictograms = Array.from(pictogramSet);
    }

    // Remove legacy flag keys to avoid storing stale data
    PICTOGRAMS.forEach(({ key }) => {
      const flagKey = `contains_${key}`;
      if (flagKey in body) delete body[flagKey];
    });

    if (req.file) {
      body.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype || "image/png",
      };
    }

    const updated = await Food.findOneAndUpdate(q, body, { new: true });
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
