// ./backend/lib/session.js
const jwt = require("jsonwebtoken");

const COOKIE_NAME = "session"; // ✅ unified cookie name everywhere
const isProd =
  process.env.NODE_ENV === "production" || process.env.FORCE_HTTPS === "true";

/**
 * Set the session cookie adaptively for dev (HTTP) and prod (HTTPS)
 */
function setSessionCookie(res, payload) {
  const token = jwt.sign(payload, process.env.SESSION_JWT_SECRET, {
    expiresIn: "30d",
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,                    // ✅ only requires HTTPS in production
    sameSite: isProd ? "none" : "lax", // ✅ 'none' for HTTPS, 'lax' for localhost/LAN
    domain: isProd ? process.env.COOKIE_DOMAIN || ".carebells.org" : undefined,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30,  // 30 days
  });
}

/**
 * Read and verify the JWT from the cookie
 */
function readSession(req) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return null;
  try {
    return jwt.verify(token, process.env.SESSION_JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Clear the cookie safely on logout
 */
function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    domain: isProd ? process.env.COOKIE_DOMAIN || ".carebells.org" : undefined,
  });
}

module.exports = { setSessionCookie, readSession, clearSessionCookie, COOKIE_NAME };
