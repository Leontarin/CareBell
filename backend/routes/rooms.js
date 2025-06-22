const express = require('express');
const router = express.Router();
const Room = require('../models/room');

// Create a new room and add the user as the first participant
router.post('/create', async (req, res) => {
  try {
    const { name, userId } = req.body;
    if (!name || !userId) return res.status(400).json({ error: 'Missing name or userId' });
    
    // Check if room already exists
    const existingRoom = await Room.findOne({ name });
    if (existingRoom) {
      return res.status(400).json({ error: 'Room name already exists' });
    }
    
    const room = new Room({ name, participants: [userId], isActive: true });
    await room.save();
    
    // Emit to all clients that a new room was created
    req.app.get('io').emit('room-created', room);
    
    res.status(201).json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Join a room
router.post('/join', async (req, res) => {
  try {
    const { roomName, userId } = req.body; // Changed from roomId to roomName
    const room = await Room.findOne({ name: roomName });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    
    if (!room.participants.includes(userId)) {
      room.participants.push(userId);
      await room.save();
      
      // Emit participant update
      req.app.get('io').emit('room-updated', room);
    }
    
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Leave a room (and delete if empty)
router.post('/leave', async (req, res) => {
  try {
    const { roomName, userId } = req.body; // Changed from roomId to roomName
    const room = await Room.findOne({ name: roomName });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    
    room.participants = room.participants.filter(id => id.toString() !== userId);
    
    if (room.participants.length === 0) {
      await room.deleteOne();
      // Emit room deletion
      req.app.get('io').emit('room-deleted', { name: roomName });
      return res.json({ message: 'Room deleted' });
    } else {
      await room.save();
      // Emit participant update
      req.app.get('io').emit('room-updated', room);
      return res.json(room);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all rooms
router.get('/', async (req, res) => {
  try {
    const rooms = await Room.find();
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get room by ID with participants
router.get('/:roomId', async (req, res) => {
  try {
    const room = await Room.findById(req.params.roomId);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update room status (active/inactive)
router.patch('/:roomId/status', async (req, res) => {
  try {
    const { isActive } = req.body;
    const room = await Room.findByIdAndUpdate(
      req.params.roomId,
      { isActive },
      { new: true }
    );
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
