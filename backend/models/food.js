// backend/models/food.js
const mongoose = require("mongoose");

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

    additives: [String],
    allergens: [String],
    pictograms: [String],
    diabeticFriendly: { type: Boolean, required: true },

    contains_R: Boolean,
    contains_S: Boolean,
    contains_G: Boolean,
    contains_M: Boolean,
    contains_A: Boolean,
    contains_W: Boolean,
    contains_K: Boolean,
    contains_Y: Boolean,
  },
  { timestamps: true }
);

// Indexes
foodSchema.index({ barcode: 1 });
foodSchema.index({ id: 1 }, { unique: true });

module.exports = mongoose.model("Food", foodSchema);
