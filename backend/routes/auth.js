// /backend/routes/auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/user");
const { setSessionCookie, readSession, clearSessionCookie } = require("../lib/session");

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- Local register (optional) ---
router.post("/register", async (req, res) => {
  try {
    const { email, password, fullName } = req.body;
    if (!email || !password || !fullName) return res.status(400).json({ message: "Missing fields" });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ message: "Email already in use" });

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      id: email,                           // or your own id scheme
      email: email.toLowerCase(),
      fullName,
      passwordHash,
    });

    setSessionCookie(res, { uid: user._id.toString(), email: user.email });
    res.status(201).end();
  } catch {
    res.status(400).json({ message: "Registration failed" });
  }
});

// --- Local login ---
router.post("/login", async (req, res) => {
  try {
    const { emailOrUsername, password } = req.body;
    if (!emailOrUsername || !password) return res.status(400).json({ message: "Missing credentials" });

    const key = emailOrUsername.toLowerCase();
    const user = await User.findOne({ $or: [{ email: key }, { username: key }] });
    if (!user || !user.passwordHash) return res.status(401).json({ message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    setSessionCookie(res, { uid: user._id.toString(), email: user.email });
    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
    res.status(204).end();
  } catch {
    res.status(400).json({ message: "Login failed" });
  }
});

// --- Google login (ID token -> session) ---
router.post("/google", async (req, res) => {
  const { id_token } = req.body;
  if (!id_token) return res.status(400).json({ message: "Missing id_token" });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: id_token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    if (!payload) return res.status(401).json({ message: "Invalid Google token" });

    const { sub: googleId, email, name, picture } = payload;

    // upsert user
    let user = await User.findOne({ $or: [{ googleId }, { email }] });
    if (!user) {
      user = await User.create({
        id: email || googleId,
        email,
        fullName: name || "Google User",
        googleId,
        picture,
      });
    } else {
      await User.updateOne(
        { _id: user._id },
        { $set: { googleId, picture, fullName: name ?? user.fullName, lastLoginAt: new Date() } }
      );
    }

    setSessionCookie(res, { uid: user._id.toString(), email: user.email });
    res.status(204).end();
  } catch {
    res.status(401).json({ message: "Auth failed" });
  }
});

// --- Me (session check) ---
router.get("/me", async (req, res) => {
  const sess = readSession(req);
  if (!sess?.uid) return res.status(401).json({ message: "No session" });
  const user = await User.findById(sess.uid).select("-passwordHash");
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user);
});

// --- Logout ---
router.post("/logout", (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

module.exports = router;
