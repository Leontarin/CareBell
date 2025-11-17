//backend/routes/admin/users.js
const express = require("express");
const router = express.Router();
const User = require("../../models/user");
const AdminBackup = require("../../models/adminBackup");
const isAdmin = require("../../middleware/isAdmin");
const { safeUserQuery, parseArray } = require("../../lib/utils");
const { derivePictogramsFromAllergens,
  mergePictograms
 } = require("../../../shared/constants/foodMeta.utils.js");
const bcrypt = require("bcrypt");
const Admin = require("../../models/admin");

// Apply admin guard to every route here
router.use(isAdmin);

// ────────────────────────────────
//  GET: List all users (derived pictograms)
// ────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const users = await User.find({}, { passwordHash: 0 }).lean({ getters: true });

    const normalized = users.map((u) => ({
      ...u,
      allergens: Array.isArray(u.allergens) ? u.allergens : [],
      pictograms: Array.isArray(u.pictograms)
        ? u.pictograms
        : derivePictogramsFromAllergens(u.allergens || []),
      Diabetic: !!u.Diabetic,
    }));

    res.json(normalized);
  } catch (e) {
    console.error("Admin list fetch failed:", e);
    res.status(500).json({ message: e.message });
  }
});

// ────────────────────────────────
//  POST: Add new user (array-based allergens)
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
      allergens,
      pictograms,
      Diabetic = false,
    } = req.body;

    if (!fullName)
      return res.status(400).json({ message: "Missing required field: fullName" });
    if (!email && !username)
      return res.status(400).json({ message: "Either email or username is required" });

    const query = [
      ...(id ? [{ id }] : []),
      ...(username ? [{ username }] : []),
      ...(email ? [{ email }] : []),
    ];
    const existing = query.length ? await User.findOne({ $or: query }) : null;
    if (existing)
      return res.status(409).json({ message: "User already exists" });

    const hashed = password ? await bcrypt.hash(password, 10) : undefined;

    // Normalize and derive
    const parsedAllergens = parseArray(allergens);
    let parsedPictos = parseArray(pictograms);
    const auto = derivePictogramsFromAllergens(parsedAllergens);
    parsedPictos = mergePictograms(auto, parsedPictos);

    const newUser = new User({
      id: id || crypto.randomUUID(),
      fullName: fullName.trim(),
      username: username?.trim() || undefined,
      email: email?.trim() || undefined,
      phoneNumber,
      address,
      dateOfBirth,
      gender,
      allergens: parsedAllergens,
      pictograms: parsedPictos,
      Diabetic,
      ...(hashed && { passwordHash: hashed }),
    });

    const saved = await newUser.save();
    const { passwordHash, ...safe } = saved.toObject();
    res.status(201).json(safe);
  } catch (e) {
    console.error("Admin add user failed:", e);
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

    // Normalize arrays from request
    const parsedAllergens = parseArray(req.body.allergens);
    let parsedPictos = parseArray(req.body.pictograms);

    // Derive pictograms if empty
    if ((!parsedPictos || parsedPictos.length === 0) && parsedAllergens.length > 0) {
      parsedPictos = derivePictogramsFromAllergens(parsedAllergens);
    }

    req.body.allergens = parsedAllergens;
    req.body.pictograms = parsedPictos;
    req.body.Diabetic = !!req.body.Diabetic;

    // ────────────────────────────────
    //  Sanitize empty strings → null
    // ────────────────────────────────
    if (req.body.email !== undefined) {
      const e = String(req.body.email).trim().toLowerCase();
      if (!e) {
        delete req.body.email; // omit instead of writing null
      } else {
        req.body.email = e;
      }
    }

    if (req.body.username !== undefined) {
      const e = String(req.body.username).trim().toLowerCase();
      if (!e) {
        delete req.body.username; // omit instead of writing null
      } else {
        req.body.username = e;
      }
    }

    // ────────────────────────────────
    //  Apply updates and save
    // ────────────────────────────────
    // Apply updates and handle unsets for cleared identifiers
    Object.assign(user, req.body);

    // Explicitly unset blank identifiers
    if (!req.body.email) user.set("email", undefined);
    if (!req.body.username) user.set("username", undefined);

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
