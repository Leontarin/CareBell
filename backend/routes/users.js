//backend/routes/users.js
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

    // ✅ Runtime admin language override (no DB change)
    const Admin = require("../models/admin");
    const adminRecord = await Admin.exists({ userId: user._id });

    const safe = user.toObject();
    if (adminRecord) {
      const { LANGUAGE_CODES } = require("../lib/language");
      safe.isAdmin = true;
      safe.languages = [...LANGUAGE_CODES];
    }

    res.json(safe);
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
// ────────────────────────────────
router.patch("/:id/health", async (req, res) => {
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

    const allowedFields = [
      "R", "S", "G", "M", "A", "W", "K", "Y", "Diabetic"
    ];

    // Pick only allowed fields
    const filtered = Object.fromEntries(
      Object.entries(req.body).filter(([k]) => allowedFields.includes(k))
    );

    // Normalize to boolean flags
    for (const key of allowedFields) {
      if (typeof filtered[key] !== "undefined") {
        const val = filtered[key];
        filtered[key] = val === "on" || val === true;
      }
    }

    // Remove any legacy "Allergens" field entirely
    delete filtered.Allergens;

    const updatedUser = await User.findOneAndUpdate(
      safeUserQuery(id),
      filtered,
      { new: true }
    );
    if (!updatedUser)
      return res.status(404).json({ message: "User not found" });

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
