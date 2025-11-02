//backend/routes/user.js
const express = require("express");
const router = express.Router();
const User = require("../models/user");
const { readSession } = require("../lib/session");
const { safeUserQuery } = require("../lib/utils");

const BLOCKED_UPDATE_FIELDS = new Set([
  "passwordHash",
  "googleId",
  "roles",
  "isActive",
  "lastLoginAt",
  "_id",
  "__v",
  "email",
  "username",
]);

// ────────────────────────────────
//  GET: Single user (self or admin)
// ────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const session = readSession(req);
    if (!session?.uid)
      return res.status(401).json({ message: "Not authenticated" });

    const { id } = req.params;
    const currentUser = await User.findOne({ id: session.uid });
    if (!currentUser)
      return res.status(404).json({ message: "Current user not found" });

    const isAdmin = currentUser.roles?.includes("admin");
    if (!isAdmin && currentUser.id !== id)
      return res.status(403).json({ message: "Forbidden" });

    const user = await User.findOne(safeUserQuery(id)).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "Not found" });

    res.json(user);
  } catch (e) {
    console.error("GET /users/:id failed:", e);
    res.status(500).json({ message: e.message });
  }
});

// ────────────────────────────────
//  PUT: Update Profile (self or admin)
// ────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const session = readSession(req);
    if (!session?.uid)
      return res.status(401).json({ message: "Not authenticated" });

    const { id } = req.params;
    const currentUser = await User.findOne({ id: session.uid });
    if (!currentUser)
      return res.status(404).json({ message: "Current user not found" });

    const isAdmin = currentUser.roles?.includes("admin");
    if (!isAdmin && currentUser.id !== id)
      return res.status(403).json({ message: "Forbidden" });

    const updates = { ...req.body };
    delete updates.id;

    // Remove any restricted fields
    for (const key of Object.keys(updates)) {
      if (BLOCKED_UPDATE_FIELDS.has(key)) delete updates[key];
    }

    const user = await User.findOne(safeUserQuery(id));
    if (!user) return res.status(404).json({ message: "User not found" });

    Object.assign(user, updates);
    const saved = await user.save();
    const safe = saved.toObject();
    delete safe.passwordHash;

    // Optional consistency: include isAdmin for frontend harmony
    const Admin = require("../models/admin");
    const adminRecord = await Admin.exists({ userId: user._id });

    res.json({ ...safe, isAdmin: !!adminRecord });
  } catch (e) {
    console.error("PUT /users/:id failed:", e);
    res.status(400).json({ message: e.message });
  }
});

// ────────────────────────────────
//  PATCH: Update Health (self or admin)
//  Flow: Frontend sends allergens + Diabetic → backend expands groups → derives pictograms → saves in Mongo
// ────────────────────────────────
router.patch("/:id/health", async (req, res) => {
  try {
    const session = readSession(req);
    if (!session?.uid)
      return res.status(401).json({ message: "Not authenticated" });

    const { id } = req.params;

    // ───── Verify user authorization ─────
    const currentUser = await User.findOne({ id: session.uid });
    if (!currentUser)
      return res.status(404).json({ message: "Current user not found" });

    const isAdmin = currentUser.roles?.includes("admin");
    if (!isAdmin && currentUser.id !== id)
      return res.status(403).json({ message: "Forbidden" });

    // ───── Load shared utils ─────
    const { parseArray, parseBool } = require("../lib/utils");
    const {
      expandAllergenGroups,
      derivePictogramsFromAllergens,
    } = require("../../shared/constants/foodMeta.utils.js");

    // ───── Parse incoming data ─────
    const allergensRaw = parseArray(req.body.allergens);
    const allergens = expandAllergenGroups(allergensRaw); // expand groups (A, H, N)
    const Diabetic = parseBool(req.body.Diabetic);

    // ───── Derive pictograms ─────
    const pictograms = derivePictogramsFromAllergens(allergens);

    // ───── Save to Mongo ─────
    const updatedUser = await User.findOneAndUpdate(
      safeUserQuery(id),
      { allergens, pictograms, Diabetic },
      { new: true }
    );

    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

    // ───── Enrich frontend response ─────
    const Admin = require("../models/admin");
    const adminRecord = await Admin.exists({ userId: updatedUser._id });

    const safe = updatedUser.toObject();
    delete safe.passwordHash;

    res.json({ ...safe, isAdmin: !!adminRecord });
  } catch (err) {
    console.error("PATCH /users/:id/health failed:", err);
    res.status(500).json({
      message: "Failed to update health info",
      error: err.message,
    });
  }
});

module.exports = router;
