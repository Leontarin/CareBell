const express = require('express');
const router = express.Router();
const Room = require('../models/room');
const User = require('../models/user');

// Create a new room and add the user as the first participant
router.post('/create', async (req, res) => {
  try {
    const { name, userId } = req.body;
    if (!name || !userId) return res.status(400).json({ error: 'Missing name or userId' });
    const room = new Room({ name, participants: [userId] });
    await room.save();
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Join a room
router.post('/join', async (req, res) => {
  try {
    const { roomId, userId } = req.body;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    if (!room.participants.includes(userId)) {
      room.participants.push(userId);
      await room.save();
    }
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leave a room (and delete if empty)
router.post('/leave', async (req, res) => {
  try {
    const { roomId, userId } = req.body;
    const room = await Room.findById(roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    room.participants = room.participants.filter(id => id.toString() !== userId);
    if (room.participants.length === 0) {
      await room.deleteOne();
      return res.json({ message: 'Room deleted' });
    } else {
      await room.save();
      return res.json(room);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find().populate('participants', 'fullName');
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
