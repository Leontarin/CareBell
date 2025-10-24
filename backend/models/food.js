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

function sanitizeList(values, validSet) {
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
      set: (values) => sanitizeList(values, VALID_ADDITIVES),
    },
    allergens: {
      type: [String],
      default: [],
      set: (values) => sanitizeList(values, VALID_ALLERGENS),
    },
    pictograms: {
      type: [String],
      default: [],
      set: (values) => sanitizeList(values, VALID_PICTOGRAMS),
    },
    diabeticFriendly: { type: Boolean, required: true, default: false },
  },
  { timestamps: true }
);

foodSchema.set("toJSON", { virtuals: true });
foodSchema.set("toObject", { virtuals: true });

foodSchema.virtual("derivedPictograms").get(function derived() {
  return derivePictogramsFromAllergens(this.allergens || [], PICTOGRAMS);
});

// Indexes
foodSchema.index({ barcode: 1 });
foodSchema.index({ id: 1 }, { unique: true });

module.exports = mongoose.model("Food", foodSchema);
