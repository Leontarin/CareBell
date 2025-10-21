const express = require("express");
const bcrypt = require("bcrypt");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/user");
const { computeLanguageSettings, normalizeUserLanguage } = require("../lib/language");
const { setSessionCookie, readSession, clearSessionCookie } = require("../lib/session");

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ────────────────────────────────
//  LOCAL REGISTER
// ────────────────────────────────
router.post("/register", async (req, res) => {
  try {
    const {
      email,
      username,
      password,
      fullName,
      dateOfBirth,
      gender,
      phoneNumber,
      country,
      language,
    } = req.body;

    if (!fullName || !password || (!email && !username)) {
      return res.status(400).json({
        message: "Missing required fields (fullName, password, and either email or username)",
      });
    }

    const emailKey = email?.trim().toLowerCase() || null;
    const usernameKey = username?.trim().toLowerCase() || null;

    // ✅ Check for duplicates only if a real value exists
    const existing = await User.findOne({
      $or: [
        ...(emailKey ? [{ email: emailKey }] : []),
        ...(usernameKey ? [{ username: usernameKey }] : []),
      ],
    });

    if (existing) {
      const conflictField = existing.email === emailKey ? "Email" : "Username";
      return res.status(409).json({ message: `${conflictField} already in use` });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const userData = {
      id: usernameKey || emailKey, // consistent user identifier
      fullName,
      passwordHash,
      gender: gender || "other",
      phoneNumber: phoneNumber?.trim() || undefined,
    };

    if (emailKey) userData.email = emailKey;
    if (usernameKey) userData.username = usernameKey;

    if (dateOfBirth) userData.dateOfBirth = new Date(dateOfBirth);

    // Language defaults
    if (country || language) {
      try {
        const settings = computeLanguageSettings({
          country,
          preferredLanguage: language,
        });
        userData.country = settings.country;
        userData.language = settings.language;
        userData.languages = settings.languages;
      } catch (langErr) {
        return res.status(400).json({ message: langErr.message });
      }
    }

    const user = await User.create(userData);

    console.log(`✅ Registered new user: ${user.username || user.email}`);

    setSessionCookie(res, { uid: user.id, email: user.email });
    res.status(201).end();
  } catch (err) {
    console.error("❌ Registration error:", err);
    if (err.code === 11000) {
      const key = Object.keys(err.keyValue || {})[0] || "field";
      return res.status(409).json({ message: `Duplicate ${key}: already exists` });
    }
    res.status(400).json({ message: err.message || "Registration failed" });
  }
});

// ────────────────────────────────
//  LOCAL LOGIN
// ────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { emailOrUsername, password = "" } = req.body;
    if (!emailOrUsername) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    const raw = String(emailOrUsername).trim();
    const key = raw.toLowerCase();

    let user = null;

    // Detect whether it's likely an email or username
    if (key.includes("@")) {
      user = await User.findOne({ email: key }).select("+passwordHash");
    } else {
      user = await User.findOne({
        $or: [{ username: key }, { id: key }],
      }).select("+passwordHash");
    }

    if (!user) return res.status(401).json({ message: "Invalid credentials" });

    if (!user.passwordHash) {
      if (password === "") {
        setSessionCookie(res, { uid: user.id, email: user.email });
        await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
        return res.status(204).end();
      }
      return res
        .status(401)
        .json({ message: "This account does not use a password (try Google login)" });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid credentials" });

    setSessionCookie(res, { uid: user.id, email: user.email });
    await User.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
    res.status(204).end();
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(400).json({ message: err.message || "Login failed" });
  }
});

// ────────────────────────────────
//  GOOGLE LOGIN
// ────────────────────────────────
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
        {
          $set: {
            googleId,
            picture,
            fullName: name ?? user.fullName,
            lastLoginAt: new Date(),
          },
        }
      );
    }

    setSessionCookie(res, { uid: user.id, email: user.email });
    res.status(204).end();
  } catch (err) {
    console.error("❌ Google auth error:", err);
    res.status(401).json({ message: err.message || "Google authentication failed" });
  }
});

// ────────────────────────────────
//  SESSION CHECK
// ────────────────────────────────
const Admin = require("../models/admin");

router.get("/me", async (req, res) => {
  const sess = readSession(req);
  if (!sess?.uid) return res.status(401).json({ message: "No session" });

  try {
    // Use your safe lookup function if available
    const user = await User.findOne({ id: sess.uid }).select("-passwordHash");
    if (!user) return res.status(404).json({ message: "User not found" });

    // Normalize language if needed
    const { changed } = normalizeUserLanguage(user);
    if (changed) {
      try {
        await user.save();
      } catch (err) {
        console.error("Failed to persist normalized language settings", err);
      }
    }

    // ✅ Admin check (only by ObjectId)
    let isAdmin = false;
    try {
      if (user._id) {
        isAdmin = !!(await Admin.exists({ userId: user._id }));
      }
    } catch (err) {
      console.error("Admin check failed:", err);
    }

    res.json({ ...user.toObject(), isAdmin });
  } catch (err) {
    console.error("❌ /me error:", err);
    res.status(500).json({ message: "Internal error" });
  }
});
// ────────────────────────────────
//  LOGOUT
// ────────────────────────────────
router.post("/logout", (req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});

module.exports = router;
