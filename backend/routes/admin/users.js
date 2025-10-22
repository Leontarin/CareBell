//backend/routes/admin/users.js
const express = require("express");
const router = express.Router();
const User = require("../../models/user");
const AdminBackup = require("../../models/adminBackup");
const isAdmin = require("../../middleware/isAdmin");
const { safeUserQuery } = require("../../lib/utils");
const bcrypt = require("bcrypt");
const Admin = require("../../models/admin");

// Apply admin guard to every route here
router.use(isAdmin);

// ────────────────────────────────
//  GET: List all users
// ────────────────────────────────
router.get("/", async (req, res) => {
  try {
    // Always fetch fresh data, not cached docs
    const users = await User.find({}, { passwordHash: 0 }).lean({ getters: true });

    // Normalize fields so checkboxes match backend
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
      // ⚠️ Drop textual allergens — localization handles text in frontend
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
      Diabetic,
    } = req.body;

    if (!fullName)
      return res.status(400).json({ message: "Missing required field: fullName" });
    
    if (!email && !username) {
      return res
        .status(400)
        .json({ message: "Either email or username is required" });
    }

    const query = [
      ...(id ? [{ id }] : []),
      ...(username ? [{ username }] : []),
      ...(email ? [{ email }] : []),
    ];
    
    const existing = query.length ? await User.findOne({ $or: query }) : null;
    
    if (existing)
      return res
        .status(409)
        .json({ message: "User with this ID, username, or email already exists" });

    const hashed = password ? await bcrypt.hash(password, 10) : undefined;

    // Normalize allergen flags
    const allergenKeys = ["R", "S", "G", "M", "A", "W", "K", "Y"];
    const allergenFlags = {};
    allergenKeys.forEach((key) => {
      allergenFlags[key] = req.body[key] === "on" || req.body[key] === true;
    });

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
//  PATCH: Update a user (with backup, safe duplicate handling)
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
    //  Safe duplicate check
    // ────────────────────────────────
    const { email, username } = req.body;
    const emailKey = email?.trim().toLowerCase() || null;
    const usernameKey = username?.trim().toLowerCase() || null;

    // Check duplicates only if real values exist
    const query = [
      ...(emailKey ? [{ email: emailKey }] : []),
      ...(usernameKey ? [{ username: usernameKey }] : []),
    ];

    if (query.length > 0) {
      const existing = await User.findOne({
        $or: query,
        _id: { $ne: user._id }, // exclude self
      });
      if (existing) {
        const conflictField = existing.email === emailKey ? "Email" : "Username";
        return res.status(409).json({ message: `${conflictField} already in use` });
      }
    }

    // ────────────────────────────────
    //  Normalize allergen flags only (no textual array)
    // ────────────────────────────────
    const allergenKeys = ["R", "S", "G", "M", "A", "W", "K", "Y"];
    allergenKeys.forEach((key) => {
      const val = req.body[key];
      req.body[key] = val === "on" || val === true;
    });

    delete req.body.Allergens; // textual array removed

    // ────────────────────────────────
    //  Sanitize empty strings → null
    // ────────────────────────────────
    if (req.body.email !== undefined) {
      if (!req.body.email || !req.body.email.trim()) {
        req.body.email = null;
      } else {
        req.body.email = req.body.email.trim().toLowerCase();
      }
    }

    if (req.body.username !== undefined) {
      if (!req.body.username || !req.body.username.trim()) {
        req.body.username = null;
      } else {
        req.body.username = req.body.username.trim().toLowerCase();
      }
    }

    // ────────────────────────────────
    //  Apply updates and save
    // ────────────────────────────────
    Object.assign(user, req.body);
    const saved = await user.save();
    const safe = saved.toObject();
    delete safe.passwordHash;

    // 🔁 Keep admin session in sync when editing self
    if (req.session?.user && String(user._id) === String(req.session.user._id)) {
      req.session.user = {
        ...req.session.user,
        ...req.body,
        updatedAt: new Date(),
      };
      console.log("🔄 Session user refreshed after self-edit via Admin panel");
    }

    res.json({ message: "User updated", user: safe });
  } catch (e) {
    console.error("Admin user update failed:", e);
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

// ────────────────────────────────
//  PATCH: Update user role (and sync Admin table)
// ────────────────────────────────
router.patch("/:id/role", async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["user", "superadmin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findOne(safeUserQuery(id));
    if (!user) return res.status(404).json({ message: "User not found" });

    // Update user's role array
    user.roles = [role];
    await user.save();

    // Sync with Admin collection
    const existingAdmin = await Admin.findOne({ userId: user._id });

    if (role === "superadmin") {
      // If user not admin, create or upgrade
      if (!existingAdmin) {
        await Admin.create({ userId: user._id, role: "superadmin" });
      } else if (existingAdmin.role !== "superadmin") {
        existingAdmin.role = "superadmin";
        await existingAdmin.save();
      }
    } else if (role === "user") {
      // Remove from Admins if currently listed
      if (existingAdmin) {
        await existingAdmin.deleteOne();
      }
    }

    res.json({ message: "Role updated successfully", role });
  } catch (e) {
    console.error("Admin role update failed:", e);
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
