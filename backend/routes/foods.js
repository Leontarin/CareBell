const express = require("express");
const router = express.Router();
const Food = require("../models/food");

router.get("/", async (req, res) => {
  const foods = await Food.find();
  res.json(foods);
});

router.get("/:barcode", async (req, res) => {
  try {
    const food = await Food.findOne({ barcode: req.params.barcode });
    if (!food) return res.status(404).json({ message: "Not found" });
    res.json(food);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/addFood", async (req, res) => {
  try {
    const {
      barcode,
      imageURL,
      id,
      Date,
      Category,
      Dish,
      Description,
      Additives,
      Allergens,
      Pictograms,
      diabetic_friendly,
      contains_R,
      contains_S,
      contains_G,
      contains_M,
      contains_A,
      contains_W,
      contains_K,
      contains_Y,
    } = req.body;

    const newFood = new Food({
      barcode,
      imageURL,
      id,
      date: Date,
      category: Category,
      dish: Dish,
      description: Description || null,
      additives: Additives || [],
      allergens: Allergens || [],
      pictograms: Pictograms || [],
      diabeticFriendly: diabetic_friendly,
      contains_R,
      contains_S,
      contains_G,
      contains_M,
      contains_A,
      contains_W,
      contains_K,
      contains_Y,
    });

    const saved = await newFood.save();
    res.status(201).json(saved);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
