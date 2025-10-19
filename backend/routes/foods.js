// backend/routes/foods.js
const express = require("express");
const mongoose = require("mongoose");
const Food = require("../models/food");
const { AVAILABLE_LANGUAGES } = require("../lib/language");

const router = express.Router();

// Utility: allow both ObjectId and numeric lookups
function safeFoodQuery(idOrString) {
  if (!idOrString) return {};
  if (mongoose.Types.ObjectId.isValid(idOrString)) {
    return { $or: [{ _id: idOrString }, { id: Number(idOrString) || idOrString }] };
  }
  const asNum = Number(idOrString);
  if (!Number.isNaN(asNum)) return { id: asNum };
  return { id: idOrString };
}

/* ─────────────────────────────────────────────
   Helper to localize a food doc
────────────────────────────────────────────── */
function toPlainTranslations(value) {
  if (!value) return undefined;

  const entries = value instanceof Map ? [...value.entries()] : Object.entries(value);
  if (!entries.length) return undefined;

  const result = {};
  for (const [lang, raw] of entries) {
    if (!lang) continue;
    const plain =
      raw && typeof raw === "object" && typeof raw.toObject === "function"
        ? raw.toObject()
        : { ...(raw || {}) };
    result[lang] = {
      dish: plain.dish || "",
      description: plain.description || "",
      category: plain.category || "",
    };
  }

  return result;
}

function localizeFood(food, lang = "en", includeFull = false) {
  const f = food.toObject ? food.toObject() : { ...food };
  const tr = toPlainTranslations(f.translations) || {};

  const normalizedLang = AVAILABLE_LANGUAGES.includes(lang) ? lang : "en";
  const t = tr[normalizedLang] || tr.en || {};

  // flatten localized values for easy access
  f.dish = t.dish || f.dish;
  f.description = t.description || f.description;
  f.category = t.category || f.category;

  if (!includeFull) {
    delete f.translations;
  } else {
    f.translations = tr;
  }

  if (f.image && f.image.data) delete f.image;

  const imageId = f.id ?? f._id;
  f.imageURL = imageId ? `/foods/${imageId}/image` : null;
  return f;
}

/* ─────────────────────────────────────────────
   GET /foods  → all foods (localized)
────────────────────────────────────────────── */
router.get("/", async (req, res) => {
  try {
    const lang =
      (req.query.lang ||
        req.headers["accept-language"]?.split(",")[0]?.split("-")[0])?.toLowerCase() || "en";
    const includeFull = req.query.full === "true";

    const foods = await Food.find().sort({ createdAt: -1 }).lean();
    const localized = foods.map((f) => localizeFood(f, lang, includeFull));
    res.json(localized);
  } catch (e) {
    console.error("GET /foods failed:", e);
    res.status(500).json({ message: e.message });
  }
});

/* ─────────────────────────────────────────────
   GET /foods/:barcode  → single item (localized)
────────────────────────────────────────────── */
router.get("/:barcode", async (req, res) => {
  try {
    const lang =
      (req.query.lang ||
        req.headers["accept-language"]?.split(",")[0]?.split("-")[0])?.toLowerCase() || "en";
    const includeFull = req.query.full === "true";

    const food = await Food.findOne({ barcode: req.params.barcode });
    if (!food) return res.status(404).json({ message: "Not found" });

    res.json(localizeFood(food, lang, includeFull));
  } catch (e) {
    console.error("GET /foods/:barcode failed:", e);
    res.status(500).json({ message: e.message });
  }
});

/* ─────────────────────────────────────────────
   GET /foods/:id/image  → binary blob
────────────────────────────────────────────── */
router.get("/:id/image", async (req, res) => {
  try {
    const food = await Food.findOne(safeFoodQuery(req.params.id)).lean();
    if (!food || !food.image || !food.image.data) {
      return res.status(404).send("Image not found");
    }
    res.contentType(food.image.contentType || "image/png");
    res.send(food.image.data);
  } catch (e) {
    console.error("GET /foods/:id/image failed:", e);
    res.status(500).send("Error retrieving image");
  }
});

module.exports = router;
