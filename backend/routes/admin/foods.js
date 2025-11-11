// backend/routes/admin/foods.js
const express = require("express");
const multer = require("multer");
const router = express.Router();

const Food = require("../../models/food");
const isAdmin = require("../../middleware/isAdmin");
const {
  safeQuery,
  parseArray,
  cleanFood,
  nextNumericId,
  wrap,
} = require("../../lib/utils");

// Import shared meta derivation logic (works in Node via CommonJS shim)
const {
  derivePictogramsFromAllergens,
  isDiabeticFriendly,
} = require("../../../shared/constants/foodMeta.utils.js");

// ──────────────────────────────────────────────────────────────────────────────
//  Admin guard
// ──────────────────────────────────────────────────────────────────────────────
router.use(isAdmin);

// ──────────────────────────────────────────────────────────────────────────────
//  Multer memory storage
// ──────────────────────────────────────────────────────────────────────────────
const upload = multer({ storage: multer.memoryStorage() });

// ──────────────────────────────────────────────────────────────────────────────
//  GET /admin/foods → list all (without image blobs)
// ──────────────────────────────────────────────────────────────────────────────
router.get(
  "/",
  wrap(async (req, res) => {
    const { q } = req.query;
    const filter = {};

    if (q && String(q).trim()) {
      const rx = new RegExp(
        String(q).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
        "i"
      );
      filter.$or = [
        { "translations.en.dish": rx },
        { "translations.en.category": rx },
        { "translations.en.description": rx },
        { barcode: rx },
      ];
    }

    const foods = await Food.find(filter).sort({ id: -1 }).lean();
    foods.forEach((f) => delete f.image);
    res.json(foods);
  })
);

// ──────────────────────────────────────────────────────────────────────────────
//  GET /admin/foods/:id/image → return stored image blob
// ──────────────────────────────────────────────────────────────────────────────
router.get(
  "/:id/image",
  wrap(async (req, res) => {
    // ⚠️ No `.lean()` — keep Buffer intact
    const food = await Food.findOne(safeQuery(req.params.id));
    if (!food || !food.image?.data) {
      return res.status(404).send("Image not found");
    }

    res.setHeader("Content-Type", food.image.contentType || "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(food.image.data);
  })
);

// ──────────────────────────────────────────────────────────────────────────────
//  POST /admin/foods → create new food
// ──────────────────────────────────────────────────────────────────────────────
router.post(
  "/",
  upload.single("image"),
  wrap(async (req, res) => {
    const { barcode, date, category, dish, description } = req.body;

    if (!barcode || !date || !category || !dish) {
      return res.status(400).json({
        message: "Missing required fields (barcode, date, category, dish)",
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

    const additives = parseArray(req.body.additives);
    const allergens = parseArray(req.body.allergens);

    // ─────────────────────────────
    //  Derived fields
    // ─────────────────────────────
    const pictograms = derivePictogramsFromAllergens(allergens);
    const diabeticFriendly = isDiabeticFriendly(additives);

    // Auto-increment numeric ID
    const numericId = await nextNumericId(Food);

    const doc = new Food({
      id: numericId,
      barcode: String(barcode),
      date: String(date),
      category: String(category),
      dish: String(dish),
      description: description ?? null,
      translations,
      additives,
      allergens,
      pictograms,
      diabeticFriendly,
    });

    if (req.file) {
      doc.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype || "image/png",
      };
    }

    await doc.save();
    res.status(201).json(cleanFood(doc));
  })
);

// ──────────────────────────────────────────────────────────────────────────────
//  PUT /admin/foods/:id → update existing food
// ──────────────────────────────────────────────────────────────────────────────
router.put(
  "/:id",
  upload.single("image"),
  wrap(async (req, res) => {
    const q = safeQuery(req.params.id);
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

    // Parse lists
    const additives = parseArray(body.additives);
    const allergens = parseArray(body.allergens);

    // Derived values
    body.additives = additives;
    body.allergens = allergens;
    body.pictograms = derivePictogramsFromAllergens(allergens);
    // Diabetic-friendly logic — honor explicit toggle, else derive
    if (body.hasOwnProperty("diabeticFriendly")) {
      body.diabeticFriendly =
        body.diabeticFriendly === "true" || body.diabeticFriendly === true;
    } else {
      body.diabeticFriendly = isDiabeticFriendly(additives);
    }

    if (req.file) {
      body.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype || "image/png",
      };
    }

    const updated = await Food.findOneAndUpdate(q, body, { new: true });
    if (!updated) return res.status(404).json({ message: "Food not found" });
    res.json(cleanFood(updated));
  })
);

// ──────────────────────────────────────────────────────────────────────────────
//  DELETE /admin/foods/:id
// ──────────────────────────────────────────────────────────────────────────────
router.delete(
  "/:id",
  wrap(async (req, res) => {
    const deleted = await Food.findOneAndDelete(safeQuery(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Food not found" });
    res.json({ success: true, message: "Food deleted", deleted: cleanFood(deleted) });
  })
);

// ──────────────────────────────────────────────────────────────────────────────
//  POST /admin/foods/bulk-delete
// ──────────────────────────────────────────────────────────────────────────────
router.post(
  "/bulk-delete",
  wrap(async (req, res) => {
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
  })
);

module.exports = router;
