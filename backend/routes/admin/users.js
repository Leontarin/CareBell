const express = require("express");
const router = express.Router();
const User = require("../../models/user");
const AdminBackup = require("../../models/adminBackup");
const isAdmin = require("../../middleware/isAdmin");
const { safeUserQuery } = require("../../lib/utils");
const bcrypt = require("bcrypt");

// Apply admin guard to every route here
router.use(isAdmin);

// ────────────────────────────────
//  GET: List all users
// ────────────────────────────────
router.get("/", async (req, res) => {
  try {
    // Always fetch fresh data, not cached documents
    const users = await User.find({}, { passwordHash: 0 }).lean({ getters: true });

    // Normalize boolean + arrays for safety
    const normalized = users.map((u) => ({
      ...u,
      R: !!u.R,
      S: !!u.S,
      G: !!u.G,
      M: !!u.M,
      A: !!u.A,
      W: !!u.W,
      K: !!u.K,
      Y: !!u.Y,
      Diabetic: !!u.Diabetic,
      Allergens: Array.isArray(u.Allergens) ? u.Allergens : [],
    }));

    res.json(normalized);
  } catch (e) {
    console.error("Admin list fetch failed:", e);
    res.status(500).json({ message: e.message });
  }
});

// ────────────────────────────────
//  POST: Add new user
// ────────────────────────────────
router.post("/add", async (req, res) => {
  try {
    const {
      id,
      fullName,
      username,
      email,
      password,
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

    if (!fullName)
      return res.status(400).json({ message: "Missing required field: fullName" });

    const existing = await User.findOne({
      $or: [{ id }, { username }, { email }],
    });
    if (existing)
      return res
        .status(409)
        .json({ message: "User with this ID, username, or email already exists" });

    const hashed = password ? await bcrypt.hash(password, 10) : undefined;

    // Build consistent allergens
    const allergenKeys = ["R", "S", "G", "M", "A", "W", "K", "Y"];
    const allergenFlags = {};
    allergenKeys.forEach((key) => {
      allergenFlags[key] = req.body[key] === "on" || req.body[key] === true;
    });
    const allergenArray = allergenKeys.filter((k) => allergenFlags[k]);

    const newUser = new User({
      id: id || crypto.randomUUID(),
      fullName,
      username,
      email,
      phoneNumber,
      address,
      dateOfBirth,
      gender,
      ...allergenFlags,
      Allergens: allergenArray,
      Diabetic: Diabetic ?? false,
      ...(hashed && { passwordHash: hashed }),
    });

    const saved = await newUser.save();
    const { passwordHash, ...safe } = saved.toObject();
    res.status(201).json(safe);
  } catch (e) {
    console.error(e);
    res.status(400).json({ message: e.message });
  }
});

// ────────────────────────────────
//  PATCH: Update a user (with backup)
// ────────────────────────────────
router.patch("/:id", async (req, res) => {
  try {
    const user = await User.findOne(safeUserQuery(req.params.id));
    if (!user) return res.status(404).json({ message: "User not found" });

    // Optional backup before changing
    await AdminBackup.create({
      entity: "user",
      entityId: user._id,
      backupData: user.toObject(),
      updatedBy: req.admin?.uid,
    });

    // Prevent overwriting identifying fields
    delete req.body.id;
    delete req.body._id;

    // ────────────────────────────────
    //  Keep allergens in sync
    // ────────────────────────────────
    const allergenKeys = ["R", "S", "G", "M", "A", "W", "K", "Y"];

    // Normalize flags
    allergenKeys.forEach((key) => {
      const val = req.body[key];
      if (val === "on" || val === true) req.body[key] = true;
      else if (val === "off" || val === false) req.body[key] = false;
    });

    // Build array from flags
    req.body.Allergens = allergenKeys.filter((k) => req.body[k]);

    // ────────────────────────────────
    //  Apply and save
    // ────────────────────────────────
    Object.assign(user, req.body);
    const saved = await user.save();
    const safe = saved.toObject();
    delete safe.passwordHash;

    res.json({ message: "User updated", user: safe });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// ────────────────────────────────
//  DELETE: Remove a single user
// ────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const deleted = await User.findOneAndDelete(safeUserQuery(req.params.id));
    if (!deleted) return res.status(404).json({ message: "User not found" });
    res.json({ success: true, message: "User deleted", deleted });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ────────────────────────────────
//  POST: Bulk delete users
// ────────────────────────────────
router.post("/bulk-delete", async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0)
      return res.status(400).json({ message: "No user IDs provided" });

    // Only delete where _id is valid ObjectId
    const { Types } = require("mongoose");
    const validIds = ids.filter((x) => Types.ObjectId.isValid(x));
    const result = await User.deleteMany({ _id: { $in: validIds } });
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ────────────────────────────────
//  POST: Restore from backup
// ────────────────────────────────
router.post("/:id/restore/:backupId", async (req, res) => {
  try {
    const backup = await AdminBackup.findById(req.params.backupId);
    if (!backup) return res.status(404).json({ message: "Backup not found" });

    await User.findOneAndUpdate(
      safeUserQuery(backup.entityId),
      backup.backupData
    );
    res.json({ message: "Restored to backup" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ────────────────────────────────
//  PATCH: Reset user password
// ────────────────────────────────
router.patch("/:id/reset-password", async (req, res) => {
  try {
    const { password } = req.body;
    if (!password)
      return res.status(400).json({ message: "Password is required" });

    const hashed = await bcrypt.hash(password, 10);

    const updated = await User.findOneAndUpdate(
      safeUserQuery(req.params.id),
      { passwordHash: hashed },
      { new: true }
    );

    if (!updated) return res.status(404).json({ message: "User not found" });
    res.json({ success: true, message: "Password reset successfully" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
