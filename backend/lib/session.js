//./backend/lib/session.js
const jwt = require("jsonwebtoken");

const COOKIE_NAME = "sid";
const isProd = process.env.NODE_ENV === "production";

function setSessionCookie(res, payload) {
  const token = jwt.sign(payload, process.env.SESSION_JWT_SECRET, { expiresIn: "30d" });
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,                         // only HTTPS in prod
    sameSite: isProd ? "none" : "lax",      // cross-site in prod, easy local
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function readSession(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try { return jwt.verify(token, process.env.SESSION_JWT_SECRET); }
  catch { return null; }
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
  });
}

module.exports = { setSessionCookie, readSession, clearSessionCookie, COOKIE_NAME };
