//backend/routes/foods.js
const express = require("express");
const mongoose = require("mongoose");
const Food = require("../models/food");

const router = express.Router();

// Utility: allow both ObjectId and numeric id lookups
function safeFoodQuery(idOrString) {
  if (!idOrString) return {};
  if (mongoose.Types.ObjectId.isValid(idOrString)) {
    return { $or: [{ _id: idOrString }, { id: Number(idOrString) || idOrString }] };
  }
  const asNum = Number(idOrString);
  if (!Number.isNaN(asNum)) return { id: asNum };
  return { id: idOrString };
}

/**
 * GET /foods
 * Returns all foods, excluding the binary image data.
 */
router.get("/", async (_req, res) => {
  try {
    const foods = await Food.find().sort({ createdAt: -1 }).lean({ virtuals: true });
    // Hide binary data to avoid sending megabytes
    foods.forEach(f => delete f.image);
    res.json(foods);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/**
 * GET /foods/:barcode
 * Lookup by barcode.
 */
router.get("/:barcode", async (req, res) => {
  try {
    const food = await Food.findOne({ barcode: req.params.barcode }).lean({ virtuals: true });
    if (!food) return res.status(404).json({ message: "Not found" });
    delete food.image; // remove heavy blob
    res.json(food);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

/**
 * GET /foods/:id/image
 * Publicly returns the stored image blob.
 */
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


module.exports = router;
