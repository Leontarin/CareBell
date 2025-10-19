// backend/middleware/isAdmin.js
const Admin = require("../models/admin");
const User = require("../models/user");
const { readSession } = require("../lib/session");
const { safeUserQuery } = require("../lib/utils");

module.exports = async function isAdmin(req, res, next) {
  try {
    const session = readSession(req);
    const userKey = session?.uid || session?.userId;
    if (!userKey) return res.status(401).json({ message: "Not logged in" });

    // Find the user by either _id or id (string)
    const user = await User.findOne(safeUserQuery(userKey));
    if (!user) return res.status(404).json({ message: "User not found" });

    // IMPORTANT: Admin.userId is an ObjectId in your DB → query with user._id ONLY
    const admin = await Admin.findOne({ userId: user._id });
    if (!admin) return res.status(403).json({ message: "Access denied (not admin)" });

    // attach for downstream
    req.user = user;
    req.admin = admin;
    next();
  } catch (err) {
    console.error("isAdmin error:", err);
    res.status(500).json({ message: "Internal error" });
  }
};
