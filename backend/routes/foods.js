// backend/routes/foods.js
const express = require("express");
const mongoose = require("mongoose");
const Food = require("../models/food");

const router = express.Router();

// ──────────────────────────────────────────────────────────────
// Utility: allow both ObjectId and numeric id lookups
// ──────────────────────────────────────────────────────────────
function safeFoodQuery(idOrString) {
  if (!idOrString) return {};
  if (mongoose.Types.ObjectId.isValid(idOrString)) {
    return { $or: [{ _id: idOrString }, { id: Number(idOrString) || idOrString }] };
  }
  const asNum = Number(idOrString);
  if (!Number.isNaN(asNum)) return { id: asNum };
  return { id: idOrString };
}

// ──────────────────────────────────────────────────────────────
// GET /foods → all foods (excluding binary image)
// ──────────────────────────────────────────────────────────────
router.get("/", async (_req, res) => {
  try {
    const foods = await Food.find().sort({ createdAt: -1 }).lean();
    foods.forEach((f) => delete f.image);
    res.json(foods);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /foods/:barcode → lookup by barcode
// ──────────────────────────────────────────────────────────────
router.get("/barcode/:barcode", async (req, res) => {
  try {
    const food = await Food.findOne({ barcode: req.params.barcode }).lean();
    if (!food) return res.status(404).json({ message: "Not found" });
    delete food.image;
    res.json(food);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /foods/:id/image → serve stored image blob
// ──────────────────────────────────────────────────────────────
router.get("/:id/image", async (req, res) => {
  try {
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

// ──────────────────────────────────────────────────────────────
// GET /foods/today → foods available for today's date or weekday
// ──────────────────────────────────────────────────────────────
router.get("/today", async (_req, res) => {
  try {
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const weekday = today.toLocaleDateString("en-US", { weekday: "long" });

    const foods = await Food.aggregate([
      {
        $match: {
          $or: [{ dates: todayISO }, { recurringDays: weekday }],
        },
      },
      { $group: { _id: "$_id", doc: { $first: "$$ROOT" } } },
      { $replaceRoot: { newRoot: "$doc" } },
      { $sort: { id: 1 } },
    ]);

    foods.forEach((f) => delete f.image);
    res.json(foods);
  } catch (e) {
    console.error("Error fetching today's foods:", e);
    res.status(500).json({ message: e.message });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /foods/by-date?date=YYYY-MM-DD → foods for given date
// ──────────────────────────────────────────────────────────────
router.get("/by-date", async (req, res) => {
  try {
    const targetISO = req.query.date;
    if (!targetISO) {
      return res.status(400).json({ message: "Missing ?date=YYYY-MM-DD" });
    }

    const weekday = new Date(targetISO).toLocaleDateString("en-US", { weekday: "long" });
    const foods = await Food.find({
      $or: [{ dates: targetISO }, { recurringDays: weekday }],
    }).lean();

    foods.forEach((f) => delete f.image);
    res.json(foods);
  } catch (e) {
    console.error("Error fetching foods by date:", e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
