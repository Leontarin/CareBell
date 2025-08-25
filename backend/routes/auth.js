// /backend/routes/auth.js
const express = require("express");
const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/user");
const { setSessionCookie, readSession, clearSessionCookie } = require("../lib/session");

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// --- Local register ---
router.post("/register", async (req, res) => {
  try {
    const { email, username, password, fullName, dateOfBirth, gender, phoneNumber } = req.body;

    if (!fullName || !password || (!email && !username)) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const emailKey = email?.toLowerCase();
    const usernameKey = username?.toLowerCase();

    // uniqueness checks
    if (emailKey) {
      const existing = await User.findOne({ email: emailKey });
      if (existing) return res.status(409).json({ message: "Email already in use" });
    }
    if (usernameKey) {
      const existing = await User.findOne({ username: usernameKey });
      if (existing) return res.status(409).json({ message: "Username already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      id: emailKey || usernameKey,
      fullName,
      email: emailKey || null,
      username: usernameKey || null,
      passwordHash,
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender: gender || "other",
      phoneNumber: phoneNumber || undefined,
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
    const { emailOrUsername, password = "" } = req.body;
    if (!emailOrUsername) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    const raw = String(emailOrUsername).trim();
    const key = raw.toLowerCase();

    // Also match by id (use the raw, case-preserving input for id)
    const user = await User.findOne({
      $or: [{ email: key }, { username: key }, { id: raw }],
    }).select("+passwordHash");

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // If the account has no local password, allow ONLY empty password login
    if (!user.passwordHash) {
      if (password === "") {
        setSessionCookie(res, { uid: user._id.toString(), email: user.email });
        await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
        return res.status(204).end();
      }
      return res.status(401).json({ message: "This account does not use a password. Leave it blank." });
    }

    // Otherwise verify the bcrypt hash
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
