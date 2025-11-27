// backend/routes/rtc.js
const express = require("express");
const router = express.Router();
const { AccessToken } = require("livekit-server-sdk");
const Room = require("../models/room");
const requireUser = require("../middleware/requireUser");

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

    // Load LiveKit config
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
        // Force WS for dev
    let livekitUrl = process.env.LIVEKIT_PUBLIC_URL;
    // Validate format
    if (!/^wss?:\/\//.test(livekitUrl)) {
      return res.status(500).json({ error: "LIVEKIT_PUBLIC_URL must begin with ws:// or wss://" });
    }

    if (!apiKey || !apiSecret || !livekitUrl) {
      return res.status(500).json({ error: "LiveKit config missing" });
    }

    // Create LiveKit access token
    const at = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      ttl: 60 * 60, // 1 hour
    });

    at.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
    });

    const token = await at.toJwt();

    return res.json({
      token,
      livekitUrl,
      identity: userId,
    });
  } catch (err) {
    console.error("RTC Token error:", err);
    res.status(500).json({ error: "Failed to create token" });
  }
});

module.exports = router;
