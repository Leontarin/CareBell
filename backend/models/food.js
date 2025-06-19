const mongoose = require("mongoose");

const foodSchema = new mongoose.Schema(
  {
    barcode: {
      type: String,
      required: true,
    },
    imageURL: {
      type: String,
      default: null,
    },
    id: {
      type: Number,
      required: true,
    },
    date: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      required: true,
    },
    dish: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: null,
    },
    additives: {
      type: [String],
      default: [],
    },
    allergens: {
      type: [String],
      default: [],
    },
    pictograms: {
      type: [String],
      default: [],
    },
    diabeticFriendly: {
      type: Boolean,
      required: true,
    },
    contains_R: Boolean,
    contains_S: Boolean,
    contains_G: Boolean,
    contains_M: Boolean,
    contains_A: Boolean,
    contains_W: Boolean,
    contains_K: Boolean,
    contains_Y: Boolean,
  },
  {
    timestamps: true,
  }
);

foodSchema.index({ barcode: 1 });

module.exports = mongoose.model("Food", foodSchema);
