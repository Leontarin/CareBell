const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");

const Food = require("../../models/food");
const isAdmin = require("../../middleware/isAdmin");
const { deriveAllergensFromFlags } = require("../../lib/allergenMap");
const { AVAILABLE_LANGUAGES } = require("../../lib/language");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const FLAG_KEYS = ["R", "S", "G", "M", "A", "W", "K", "Y"];

router.use(isAdmin);

function safeFoodQuery(idOrString) {
  if (!idOrString) return {};
  if (mongoose.Types.ObjectId.isValid(idOrString)) {
    return {
      $or: [
        { _id: idOrString },
        { id: Number(idOrString) || idOrString },
      ],
    };
  }
  const asNum = Number(idOrString);
  if (!Number.isNaN(asNum)) return { id: asNum };
  return { id: idOrString };
}

function normalizeText(value) {
  if (value == null) return "";
  return String(value).trim();
}

function normalizeBool(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  if (typeof value === "string") {
    return /^(1|true|yes|on)$/i.test(value.trim());
  }
  return false;
}

function normalizeArray(value) {
  if (value == null) return [];
  if (Array.isArray(value)) {
    return value
      .map((entry) => normalizeText(entry))
      .filter((entry) => entry.length > 0);
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((entry) => normalizeText(entry))
          .filter((entry) => entry.length > 0);
      }
    } catch (_) {}
    return trimmed
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return [];
}

function collectContainsFlags(source = {}, { includeMissing = false } = {}) {
  const result = {};
  for (const key of FLAG_KEYS) {
    const field = `contains_${key}`;
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      result[field] = normalizeBool(source[field]);
    } else if (includeMissing) {
      result[field] = false;
    }
  }
  return result;
}

function collectTranslations(source = {}) {
  const translations = {};
  for (const lang of AVAILABLE_LANGUAGES) {
    const dishKey = `dish_${lang}`;
    const descriptionKey = `description_${lang}`;
    const categoryKey = `category_${lang}`;

    const hasDish = Object.prototype.hasOwnProperty.call(source, dishKey);
    const hasDescription = Object.prototype.hasOwnProperty.call(
      source,
      descriptionKey
    );
    const hasCategory = Object.prototype.hasOwnProperty.call(
      source,
      categoryKey
    );

    if (!hasDish && !hasDescription && !hasCategory) continue;

    const dish = hasDish ? normalizeText(source[dishKey]) : "";
    const description = hasDescription ? normalizeText(source[descriptionKey]) : "";
    const category = hasCategory ? normalizeText(source[categoryKey]) : "";

    if (hasDish) delete source[dishKey];
    if (hasDescription) delete source[descriptionKey];
    if (hasCategory) delete source[categoryKey];

    translations[lang] = { dish, description, category };
  }
  return translations;
}

function mergeEnglishFallback(target, translations, body = {}) {
  const english = translations.en;
  if (!english) return;

  if (!normalizeText(target.dish)) {
    target.dish = english.dish || target.dish;
  }
  if (!normalizeText(target.description)) {
    target.description = english.description || target.description;
  }
  if (!normalizeText(target.category)) {
    const fallbackCategory = english.category || body.category;
    if (normalizeText(fallbackCategory)) {
      target.category = fallbackCategory;
    }
  }
}

function serializeFood(food) {
  const obj = food?.toObject ? food.toObject({ virtuals: true }) : { ...food };

  if (obj.image) delete obj.image;

  if (obj.translations instanceof Map) {
    obj.translations = Object.fromEntries(obj.translations);
  }

  const imageId = obj.id ?? obj._id;
  obj.imageURL = imageId ? `/foods/${imageId}/image` : null;

  return obj;
}

router.get("/", async (req, res) => {
  try {
    const { q } = req.query;
    const filter = {};

    if (q && q.toString().trim()) {
      const escaped = q.toString().trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const rx = new RegExp(escaped, "i");
      filter.$or = [
        { dish: rx },
        { barcode: rx },
        { category: rx },
        { description: rx },
      ];
    }

    const foods = await Food.find(filter).sort({ createdAt: -1 });
    res.json(foods.map(serializeFood));
  } catch (err) {
    console.error("Admin foods list failed:", err);
    res.status(500).json({ message: "Failed to load foods" });
  }
});

router.get("/:id/image", async (req, res) => {
  try {
    const food = await Food.findOne(safeFoodQuery(req.params.id)).lean();
    if (!food || !food.image || !food.image.data) {
      return res.status(404).send("Image not found");
    }
    res.contentType(food.image.contentType || "image/png");
    res.send(food.image.data);
  } catch (err) {
    console.error("Admin food image failed:", err);
    res.status(500).send("Error retrieving image");
  }
});

router.post("/", upload.single("image"), async (req, res) => {
  try {
    const body = { ...req.body };
    const translations = collectTranslations(body);
    const containsFlags = collectContainsFlags(body, { includeMissing: true });

    const manualAllergens = normalizeArray(body.allergens);
    const additives = normalizeArray(body.additives);
    const pictograms = normalizeArray(body.pictograms);

    const diabeticFriendly = normalizeBool(body.diabeticFriendly);
    const barcode = normalizeText(body.barcode);
    const date = normalizeText(body.date);
    const baseFields = {
      dish: normalizeText(body.dish),
      description: normalizeText(body.description),
      category: normalizeText(body.category),
    };
    mergeEnglishFallback(baseFields, translations, body);

    if (!barcode) {
      return res.status(400).json({ message: "Barcode is required" });
    }
    if (!date) {
      return res.status(400).json({ message: "Date is required" });
    }
    if (!baseFields.dish) {
      return res.status(400).json({ message: "Dish name is required" });
    }

    let numericId;
    if (body.id != null && body.id !== "") {
      numericId = Number(body.id);
      if (!Number.isFinite(numericId)) {
        return res.status(400).json({ message: "Invalid id" });
      }
    } else {
      const last = await Food.findOne().sort({ id: -1 }).lean();
      numericId = (last?.id || 0) + 1;
    }

    const derivedAllergens = deriveAllergensFromFlags(containsFlags);
    const allergenSet = new Set([...manualAllergens, ...derivedAllergens]);

    const doc = new Food({
      barcode,
      id: numericId,
      date,
      category: baseFields.category,
      dish: baseFields.dish,
      description: baseFields.description,
      diabeticFriendly,
      additives,
      pictograms,
      translations,
      ...containsFlags,
      allergens: Array.from(allergenSet),
    });

    if (req.file) {
      doc.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype || "image/png",
      };
    }

    await doc.save();
    res.status(201).json(serializeFood(doc));
  } catch (err) {
    console.error("Food creation failed:", err);
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: "A food with this barcode or id already exists" });
    }
    res.status(500).json({ message: "Failed to create food" });
  }
});

router.put("/:id", upload.single("image"), async (req, res) => {
  try {
    const food = await Food.findOne(safeFoodQuery(req.params.id));
    if (!food) return res.status(404).json({ message: "Food not found" });

    const body = { ...req.body };
    const translations = collectTranslations(body);
    const containsFlags = collectContainsFlags(body);

    if (body.barcode != null) food.barcode = normalizeText(body.barcode);
    if (body.date != null) food.date = normalizeText(body.date);
    if (body.category != null) food.category = normalizeText(body.category);
    if (body.dish != null) food.dish = normalizeText(body.dish);
    if (body.description != null)
      food.description = normalizeText(body.description);

    if (body.diabeticFriendly != null) {
      food.diabeticFriendly = normalizeBool(body.diabeticFriendly);
    }

    if (body.additives !== undefined) {
      food.additives = normalizeArray(body.additives);
    }
    if (body.pictograms !== undefined) {
      food.pictograms = normalizeArray(body.pictograms);
    }

    if (Object.keys(translations).length) {
      const existing = food.translations instanceof Map
        ? Object.fromEntries(food.translations)
        : food.translations || {};
      food.translations = { ...existing, ...translations };
      mergeEnglishFallback(food, translations, body);
    }

    if (Object.keys(containsFlags).length) {
      for (const [key, value] of Object.entries(containsFlags)) {
        food[key] = value;
      }
    }

    let manualAllergens;
    if (body.allergens !== undefined) {
      manualAllergens = normalizeArray(body.allergens);
      food.allergens = manualAllergens;
    }

    if (req.file) {
      food.image = {
        data: req.file.buffer,
        contentType: req.file.mimetype || "image/png",
      };
    }

    const flagSnapshot = FLAG_KEYS.reduce((acc, key) => {
      acc[`contains_${key}`] = food[`contains_${key}`];
      return acc;
    }, {});
    const derivedAllergens = deriveAllergensFromFlags(flagSnapshot);

    if (derivedAllergens.length || manualAllergens) {
      const union = new Set([
        ...(manualAllergens ?? food.allergens ?? []),
        ...derivedAllergens,
      ]);
      food.allergens = Array.from(union);
    } else if (!Array.isArray(food.allergens)) {
      food.allergens = [];
    }

    await food.save();
    res.json(serializeFood(food));
  } catch (err) {
    console.error("Food update error:", err);
    if (err.code === 11000) {
      return res
        .status(409)
        .json({ message: "A food with this barcode or id already exists" });
    }
    res.status(500).json({ message: "Failed to update food" });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const deleted = await Food.findOneAndDelete(safeFoodQuery(req.params.id));
    if (!deleted) return res.status(404).json({ message: "Food not found" });
    res.json({ success: true, message: "Food deleted", deleted: serializeFood(deleted) });
  } catch (err) {
    console.error("Food delete error:", err);
    res.status(500).json({ message: "Failed to delete food" });
  }
});

router.post("/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || !ids.length) {
      return res.status(400).json({ message: "Provide ids: []" });
    }

    const or = ids.map((value) => safeFoodQuery(value)).filter((query) => Object.keys(query).length);
    if (!or.length) {
      return res.json({ success: true, deletedCount: 0 });
    }

    const result = await Food.deleteMany({ $or: or });
    res.json({ success: true, deletedCount: result.deletedCount || 0 });
  } catch (err) {
    console.error("Food bulk delete error:", err);
    res.status(500).json({ message: "Failed to delete foods" });
  }
});

module.exports = router;
