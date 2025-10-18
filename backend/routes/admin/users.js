// backend/routes/admin/users.js
const express = require("express");
const router = express.Router();
const User = require("../../models/user");
const AdminBackup = require("../../models/adminBackup");
const isAdmin = require("../../middleware/isAdmin");

// Protect all admin/user routes
router.use(isAdmin);

// GET /admin/users  -> list all users (hide passwordHash)
router.get("/", async (req, res) => {
  try {
    const users = await User.find().select("-passwordHash");
    res.json(users);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// PATCH /admin/users/:id  -> update a user with backup
router.patch("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // create a backup before modifying
    await AdminBackup.create({
      entity: "user",
      entityId: user._id,
      backupData: user.toObject(),
      updatedBy: req.admin.userId,
    });

    Object.assign(user, req.body);
    const saved = await user.save();

    const safe = saved.toObject();
    delete safe.passwordHash;
    res.json({ message: "User updated", user: safe });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// POST /admin/users/:id/restore/:backupId  -> restore user from backup
router.post("/:id/restore/:backupId", async (req, res) => {
  try {
    const backup = await AdminBackup.findById(req.params.backupId);
    if (!backup) return res.status(404).json({ message: "Backup not found" });

    await User.findByIdAndUpdate(backup.entityId, backup.backupData);
    res.json({ message: "Restored to backup" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

module.exports = router;
