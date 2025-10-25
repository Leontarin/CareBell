// ──────────────────────────────────────────────────────────────────────────────
//  Imports
// ──────────────────────────────────────────────────────────────────────────────
const mongoose = require("mongoose");

const {
  derivePictogramsFromAllergens,
  isDiabeticFriendly,
} = require("../../shared/constants/foodMeta.utils.js");

// ──────────────────────────────────────────────────────────────────────────────
//  Sub-schema for multilingual text
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
//  Main food schema
// ──────────────────────────────────────────────────────────────────────────────
const foodSchema = new mongoose.Schema(
  {
    barcode: { type: String, required: true },
    image: {
      data: Buffer,
      contentType: String,
    },
    imageURL: { type: String, default: null }, // legacy fallback
    id: { type: Number, required: true },
    date: { type: String, required: true },

    // multilingual
    category: { type: String, required: true },
    dish: { type: String, required: true },
    description: { type: String, default: null },
    translations: {
      type: Map,
      of: translationSchema,
      default: {}, // e.g. { en: { dish, desc, category }, de: {...} }
    },

    // ────────────────
    //  CareBell meta
    // ────────────────
    allergens: { type: [String], default: [] },
    additives: { type: [Number], default: [] },
    pictograms: { type: [String], default: [] },
    diabeticFriendly: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ──────────────────────────────────────────────────────────────────────────────
//  Indexes
// ──────────────────────────────────────────────────────────────────────────────
foodSchema.index({ barcode: 1 });
foodSchema.index({ id: 1 }, { unique: true });

// ──────────────────────────────────────────────────────────────────────────────
//  Hooks
// ──────────────────────────────────────────────────────────────────────────────
foodSchema.pre("save", function (next) {
  try {
    // derive pictograms from allergens when allergens change
    if (this.isModified("allergens")) {
      this.pictograms = derivePictogramsFromAllergens(this.allergens || []);
    }

    // derive diabetic flag dynamically from additives
    if (this.isModified("additives")) {
      this.diabeticFriendly = isDiabeticFriendly(this.additives || []);
    }

    next();
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
//  Export
// ──────────────────────────────────────────────────────────────────────────────
module.exports = mongoose.model("Food", foodSchema);
