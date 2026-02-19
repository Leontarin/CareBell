//backend/routes/rooms.js
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Room = require('../models/room');
const { readSession } = require('../lib/session');
const isAdmin = require('../middleware/isAdmin');
const { removeUserFromAllRooms } = require('../lib/rooms/roomLifecycle');

//Test Mode and Helpr
const TEST_MODE = process.env.NODE_ENV === 'test';
function getSessionForRequest(req) {
  if (!TEST_MODE) return null;

  // Allow tests to override identity via headers
  const userId = req.header('x-test-user') || 'test-user';
  const fullName = req.header('x-test-name') || 'Test User';

  return { userId, fullName };
}

function emitRoomsChanged(req) {
  const io = req.app.get('io');
  if (io) io.emit('rooms:changed');
}

/*
  GET all rooms
*/
router.get('/', async (req, res) => {
  const rooms = await Room.find().lean();

  const formatted = rooms.map(r => ({
    _id: r._id,
    name: r.name,
    type: r.type,
    maxParticipants: r.maxParticipants,
    participantsCount: r.participants.length,
    participants: r.participants,
    isActive: r.participants.length > 0
  }));

  res.json(formatted);
});

/*
  CREATE temporary room
*/
router.post('/create', async (req, res) => {
  let session = getSessionForRequest(req);
  if (!session) {
    session = await readSession(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
  }

  const { name, maxParticipants = 8 } = req.body;

  if (!name) return res.status(400).json({ error: 'Name required' });

  const existing = await Room.findOne({ name });
  if (existing) return res.status(400).json({ error: 'Room name already exists' });

  const room = await Room.create({
    name,
    type: 'temporary',
    maxParticipants,
  });

  emitRoomsChanged(req);
  return res.json(room);
});

/*
  CREATE permanent room
*/
router.post('/create-permanent', isAdmin, async (req, res) => {
  const { name, maxParticipants = 8 } = req.body;

  if (!name) return res.status(400).json({ error: 'Name required' });

  const existing = await Room.findOne({ name });
  if (existing) return res.status(400).json({ error: 'Room name already exists' });

  const room = await Room.create({
    name,
    type: 'permanent',
    maxParticipants,
  });

  emitRoomsChanged(req);
  return res.json(room);
});

// JOIN room
router.post('/join/:roomId', async (req, res) => {
  let session = getSessionForRequest(req);
  if (!session) {
    session = await readSession(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
  }

  const { userId, fullName } = session;
  const targetRoomId = req.params.roomId;

  // 1) Enforce "one room per user" BEFORE anything else
  await removeUserFromAllRooms(userId, targetRoomId);

  // 2) Re-load the target room AFTER cleanup (fresh state)
  const room = await Room.findById(targetRoomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  // 3) Capacity check on fresh state
  if (room.participants.length >= room.maxParticipants) {
    return res.status(400).json({ error: 'Room is full' });
  }

  // 4) Add user
  room.participants.push({ userId, fullName });
  room.everHadParticipants = true; 
  await room.save();

  emitRoomsChanged(req);
  return res.json({ message: 'Joined room' });
});

/*
  LEAVE room
*/
router.post('/leave', async (req, res) => {
  let session = getSessionForRequest(req);
  if (!session) {
    session = await readSession(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.userId;

  await removeUserFromAllRooms(userId);

  emitRoomsChanged(req);
  res.json({ message: 'Left room' });
});

/*
  DELETE room (Admin only — even if active)
*/
router.delete('/:roomId', isAdmin, async (req, res) => {
  const room = await Room.findById(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  await Room.deleteOne({ _id: room._id });

  emitRoomsChanged(req);
  res.json({ message: 'Room deleted by admin' });
});

module.exports = router;
