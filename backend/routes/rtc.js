// backend/routes/rtc.js
const express = require("express");
const router = express.Router();
const { AccessToken } = require("livekit-server-sdk");
const Room = require("../models/room");
const requireUser = require("../middleware/requireUser");

/**
 * Normalize LIVEKIT_PUBLIC_URL so we always give LiveKit JS
 * a proper ws:// or wss:// URL, even if ENV is http(s)://
 */
function resolveLivekitUrlFromEnv() {
  let raw = process.env.LIVEKIT_PUBLIC_URL || "";

  raw = raw.trim();

  if (!raw) {
    throw new Error("LIVEKIT_PUBLIC_URL is not set");
  }

  // If user configured ws:// or wss:// already – great, use as-is.
  if (/^wss?:\/\//i.test(raw)) {
    return raw;
  }

  // If user configured http:// or https:// – convert to ws:// / wss://
  if (/^https?:\/\//i.test(raw)) {
    if (raw.toLowerCase().startsWith("https://")) {
      return "wss://" + raw.slice("https://".length);
    }
    if (raw.toLowerCase().startsWith("http://")) {
      return "ws://" + raw.slice("http://".length);
    }
  }

  // Anything else is invalid
  throw new Error(
    `LIVEKIT_PUBLIC_URL must be http(s):// or ws(s)://, got: ${raw}`
  );
}

router.post("/token", requireUser, async (req, res) => {
  try {
    const { roomName } = req.body;

    if (!roomName) {
      return res.status(400).json({ error: "Missing roomName" });
    }

    // Validate room exists
    const room = await Room.findOne({ name: roomName });
    if (!room) {
      return res.status(404).json({ error: "Room not found" });
    }

    // Validate user is part of the room
    const userId = req.user.id;
    if (!room.participants.includes(userId)) {
      return res.status(403).json({ error: "You are not in this room" });
    }

    // Load LiveKit secrets
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res
        .status(500)
        .json({ error: "LIVEKIT_API_KEY / LIVEKIT_API_SECRET missing" });
    }

    let livekitUrl;
    try {
      livekitUrl = resolveLivekitUrlFromEnv();
    } catch (e) {
      console.error("RTC config error:", e.message);
      return res.status(500).json({ error: e.message });
    }

    // Create LiveKit access token
    const token = new AccessToken({
      identity: userId,
      ttl: 3600,
      key: apiKey,
      secret: apiSecret,
    })
      .addGrant({
        roomJoin: true,
        room: roomName,
        canPublish: true,
        canSubscribe: true,
      })
      .toJwt();

    return res.json({
      token,
      livekitUrl, // always ws:// or wss:// at this point
      identity: userId,
    });
  } catch (err) {
    console.error("RTC Token error:", err);
    res.status(500).json({ error: "Failed to create token" });
  }
});

module.exports = router;
