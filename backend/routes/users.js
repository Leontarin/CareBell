const express = require("express");
const router = express.Router();
const User = require("../models/user");

router.get("/", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/others", async (req, res) => {
  try {
    const { excludeId } = req.query;
    if (!excludeId) return res.status(400).json({ message: "Missing excludeId" });
    
    const users = await User.find({ id: { $ne: excludeId } });
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id });
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

router.post("/addUser", async (req, res) => {
  try {
    const {
      id,
      fullName,
      phoneNumber,
      address,
      dateOfBirth,
      gender,
      R,
      S,
      G,
      M,
      A,
      W,
      K,
      Y,
      Allergens,
      Diabetic,
    } = req.body;

    // Basic validation
    if (!id || !fullName) {
      return res.status(400).json({ message: "Missing required fields: id and fullName" });
    }

    const newUser = new User({
      id,
      fullName,
      phoneNumber,
      address,
      dateOfBirth,
      gender,
      R,
      S,
      G,
      M,
      A,
      W,
      K,
      Y,
      Allergens: Allergens || [],
      Diabetic: Diabetic || false,
    });

    const saved = await newUser.save();
    res.status(201).json(saved);
  } catch (e) {
    // Handle duplicate key error specifically
    if (e.code === 11000) {
      res.status(409).json({ message: "User with this ID already exists" });
    } else {
      res.status(400).json({ message: e.message });
    }
  }
});

// Update an existing user by id
router.put("/:id", async (req, res) => {
  try {
    const updates = req.body;
    
    // Remove id from updates to prevent changing it
    delete updates.id;
    
    const user = await User.findOneAndUpdate(
      { id: req.params.id },
      updates,
      { new: true, runValidators: true }
    );
    
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

module.exports = router;