const express = require("express");
const router = express.Router();
const User = require("../models/user");

router.get("/", async (req, res) => {
  const users = await User.find();
  res.json(users);
});

router.get("/others", async (req, res) => {
  const { excludeId } = req.query;
  if (!excludeId) return res.status(400).json({ message: "Missing excludeId" });

  const users = await User.find({ id: { $ne: excludeId } });
  res.json(users);
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

  try {
    const saved = await newUser.save();
    res.status(201).json(saved);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// Update an existing user by id
router.put("/:id", async (req, res) => {
  try {
    const updates = req.body;
    const user = await User.findOneAndUpdate(
      { id: req.params.id },
      updates,
      { new: true }
    );
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json(user);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

module.exports = router;
