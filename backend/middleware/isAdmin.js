// backend/middleware/isAdmin.js
const Admin = require("../models/admin");
const { readSession } = require("../lib/session");

module.exports = async function isAdmin(req, res, next) {
  try {
    const session = await readSession(req);
    if (!session || !session.userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    const admin = await Admin.findOne({ userId: session.userId });
    if (!admin) {
      return res.status(403).json({ message: "Access denied" });
    }

    req.admin = admin; // expose role etc.
    next();
  } catch (err) {
    console.error("isAdmin error:", err);
    res.status(500).json({ message: "Internal error" });
  }
};
