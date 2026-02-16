// backend/middleware/requireUser.js
const { readSession } = require("../lib/session");

function requireUser(req, res, next) {
  const sess = readSession(req);
  if (!sess?.uid) {
    return res.status(401).json({ error: "Authentication required" });
  }
  req.user = { id: sess.uid, email: sess.email };
  next();
}

module.exports = requireUser;