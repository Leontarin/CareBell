// backend/models/food.js
const mongoose = require("mongoose");
const {
  PICTOGRAMS,
  ALLERGENS,
  ADDITIVES,
} = require("../../shared/constants/meta");
const { derivePictogramsFromAllergens } = require("../../shared/utils/derivePictograms");

const VALID_PICTOGRAMS = new Set(PICTOGRAMS.map((p) => p.key));
const VALID_ALLERGENS = new Set(ALLERGENS.map((a) => a.code));
const VALID_ADDITIVES = new Set(ADDITIVES.map((a) => a.code));

function normalizeList(list, allowedSet) {
  if (!Array.isArray(list)) {
    if (list == null) return [];
    list = [list];
  }

  const unique = new Set();
  list.forEach((value) => {
    const normalized = String(value).trim();
    if (!normalized) return;
    if (!allowedSet || allowedSet.has(normalized)) {
      unique.add(normalized);
    }
  });
  return Array.from(unique);
}

// ──────────────────────────────────────────────────────────────────────────────
// Sub-schema for multilingual text
// ──────────────────────────────────────────────────────────────────────────────
const translationSchema = new mongoose.Schema(
  {
    dish: { type: String, default: "" },
    description: { type: String, default: "" },
    category: { type: String, default: "" },
  },
  { _id: false }
);

// ──────────────────────────────────────────────────────────────────────────────
// Main food schema
// ──────────────────────────────────────────────────────────────────────────────
const foodSchema = new mongoose.Schema(
  {
    barcode: { type: String, required: true },
    image: {
      data: Buffer,
      contentType: String,
    },
    imageURL: { type: String, default: null }, // keep for backward compat
    id: { type: Number, required: true },
    date: { type: String, required: true },
    category: { type: String, required: true },
    dish: { type: String, required: true },
    description: { type: String, default: null },

    // 🔹 New multilingual field
    translations: {
      type: Map,
      of: translationSchema,
      default: {}, // e.g. { en: { dish, desc, category }, de: {...} }
    },

    additives: {
      type: [String],
      default: [],
      set: (vals) => normalizeList(vals, VALID_ADDITIVES),
      validate: {
        validator: (vals) => vals.every((val) => VALID_ADDITIVES.has(val)),
        message: "Invalid additive code",
      },
    },
    allergens: {
      type: [String],
      default: [],
      set: (vals) => normalizeList(vals, VALID_ALLERGENS),
      validate: {
        validator: (vals) => vals.every((val) => VALID_ALLERGENS.has(val)),
        message: "Invalid allergen code",
      },
    },
    pictograms: {
      type: [String],
      default: [],
      set: (vals) => normalizeList(vals, VALID_PICTOGRAMS),
      validate: {
        validator: (vals) => vals.every((val) => VALID_PICTOGRAMS.has(val)),
        message: "Invalid pictogram key",
      },
    },
    diabeticFriendly: { type: Boolean, required: true },
  },
  { timestamps: true }
);

foodSchema.set("toJSON", { virtuals: true });
foodSchema.set("toObject", { virtuals: true });

foodSchema.virtual("derivedPictograms").get(function derive() {
  if (!Array.isArray(this.allergens)) return [];
  return derivePictogramsFromAllergens(this.allergens, PICTOGRAMS);
});

// Indexes
foodSchema.index({ barcode: 1 });
foodSchema.index({ id: 1 }, { unique: true });

module.exports = mongoose.model("Food", foodSchema);
