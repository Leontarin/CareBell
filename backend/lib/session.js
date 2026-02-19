// backend/lib/session.js
const cookie = require("cookie");
const jwt = require("jsonwebtoken");

const COOKIE_NAME = "session";
const isProd =
  process.env.NODE_ENV === "production" || process.env.FORCE_HTTPS === "true";

function setSessionCookie(res, payload) {
  const token = jwt.sign(payload, process.env.SESSION_JWT_SECRET, {
    expiresIn: "30d",
  });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    domain: isProd ? process.env.COOKIE_DOMAIN : undefined,
    path: "/",
    maxAge: 1000 * 60 * 60 * 24 * 30,
  });
}

/**
 * Works for:
 * - Express: req.cookies (cookie-parser) OR req.headers.cookie
 * - Socket.IO: socket.request.headers.cookie
 */
function readSession(req) {
  try {
    const cookieHeader = req?.headers?.cookie || "";
    const cookies = req?.cookies || cookie.parse(cookieHeader || "");

    const token = cookies[COOKIE_NAME];
    if (!token) return null;

    return jwt.verify(token, process.env.SESSION_JWT_SECRET);
  } catch {
    return null;
  }
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, {
    path: "/",
    secure: isProd,
    sameSite: isProd ? "none" : "lax",
    domain: isProd ? process.env.COOKIE_DOMAIN : undefined,
  });
}

module.exports = { setSessionCookie, readSession, clearSessionCookie, COOKIE_NAME };
