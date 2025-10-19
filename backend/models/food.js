// backend/models/food.js
const mongoose = require("mongoose");

/* ──────────────────────────────────────────────
   Subschema for per-language translations
   (kept small for compact storage)
────────────────────────────────────────────── */
const translationSubSchema = new mongoose.Schema(
  {
    dish: { type: String, default: "" },
    description: { type: String, default: "" },
    category: { type: String, default: "" }, // ✅ ensure category is part of subschema
  },
  { _id: false }
);

/* ──────────────────────────────────────────────
   Main Food Schema
────────────────────────────────────────────── */
const foodSchema = new mongoose.Schema(
  {
    barcode: { type: String, required: true },

    // Blob image
    image: {
      data: Buffer,
      contentType: String,
    },
    imageURL: { type: String, default: null }, // computed field for client usage

    // Numeric incremental ID (auto-assigned in route)
    id: { type: Number, required: true, unique: true },

    date: { type: String, required: true },

    // Base English fallback
    category: { type: String, default: "" },
    dish: { type: String, default: "" },
    description: { type: String, default: "" },

    // ✅ Multilingual structure (language code → translationSubSchema)
    translations: {
      type: Map,
      of: translationSubSchema,
      default: {},
    },

    // Food info
    additives: [String],
    allergens: [String],
    pictograms: [String],
    diabeticFriendly: { type: Boolean, required: true },

    // Allergen flags
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

/* ──────────────────────────────────────────────
   Indexes
────────────────────────────────────────────── */
foodSchema.index({ barcode: 1 }, { unique: true });
foodSchema.index({ id: 1 });

/* ──────────────────────────────────────────────
   Virtuals (optional: add computed image URL)
────────────────────────────────────────────── */
foodSchema.virtual("hasImage").get(function () {
  return !!(this.image && this.image.data);
});

module.exports = mongoose.model("Food", foodSchema);
