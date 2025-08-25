// backend/routes/users.js
const express = require("express");
const router = express.Router();
const User = require("../models/user");

// OPTIONAL: protect all /users routes (uncomment next 2 lines if you want)
// const requireAuth = require("../middleware/requireAuth");
// router.use(requireAuth);

// Helper: fields we never allow clients to set through this routes file
const BLOCKED_UPDATE_FIELDS = new Set([
  "passwordHash",
  "googleId",
  "roles",
  "isActive",
  "lastLoginAt",
  "_id",
  "__v",
  "email",     // <- keep if email should only change via dedicated flow
  "username",  // <- keep if username should only change via dedicated flow
]);

// GET /users  -> list users (hide passwordHash)
router.get("/", async (req, res) => {
  try {
    const users = await User.find().select("-passwordHash");
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /users/others?excludeId=XYZ -> list users except one (hide passwordHash)
router.get("/others", async (req, res) => {
  try {
    const { excludeId } = req.query;
    if (!excludeId) return res.status(400).json({ message: "Missing excludeId" });

    const users = await User.find({ id: { $ne: excludeId } }).select("-passwordHash");
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET /users/:id -> single user (hide passwordHash)
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findOne({ id: req.params.id }).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "Not found" });
    res.json(user);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST /users/addUser -> create profile-only user (no auth fields allowed)
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
      // Ignore any unexpected fields:
      passwordHash, googleId, roles, isActive, lastLoginAt, email, username, picture, _id, __v, ...rest
    } = req.body;

    // Basic validation
    if (!id || !fullName) {
      return res.status(400).json({ message: "Missing required fields: id and fullName" });
    }
    // Optionally reject unknown keys to avoid accidental writes
    if (Object.keys(rest).length > 0) {
      return res.status(400).json({ message: "Unexpected fields in payload" });
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
      Diabetic: Diabetic ?? false,
    });

    const saved = await newUser.save();
    // hide passwordHash in response (shouldn't exist here anyway)
    const { passwordHash: _, ...safe } = saved.toObject();
    res.status(201).json(safe);
  } catch (e) {
    if (e.code === 11000) {
      res.status(409).json({ message: "User with this ID or email already exists" });
    } else {
      res.status(400).json({ message: e.message });
    }
  }
});

// PUT /users/:id -> update profile fields (block auth fields & id changes)
router.put("/:id", async (req, res) => {
  try {
    const updates = { ...req.body };

    // Never allow changing primary id via this route
    delete updates.id;

    // Block auth/sensitive fields from being updated here
    for (const key of Object.keys(updates)) {
      if (BLOCKED_UPDATE_FIELDS.has(key)) {
        delete updates[key];
      }
    }

    const user = await User.findOneAndUpdate(
      { id: req.params.id },
      updates,
      { new: true, runValidators: true }
    ).select("-passwordHash");

    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

module.exports = router;