//backend/routes/rooms.js
const express = require('express');
const router = express.Router();
const Room = require('../models/room');
const { readSession } = require('../lib/session');
const isAdmin = require('../middleware/isAdmin');
const TEST_MODE = process.env.NODE_ENV === 'test';

/*
  Helper: remove user from any existing room
*/
async function removeUserFromAllRooms(userId) {
  await Room.updateMany(
    { "participants.userId": userId },
    { $pull: { participants: { userId } } }
  );

  // Auto-delete empty temporary rooms
  await Room.deleteMany({
    type: 'temporary',
    participants: { $size: 0 }
  });
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
  CREATE room
*/
router.post('/create', async (req, res) => {
  let session;

  if (TEST_MODE) {
    session = {
      userId: 'test-user',
      fullName: 'Test User'
    };
  } else {
    session = await readSession(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
}

  const { name, type = 'temporary', maxParticipants = 8 } = req.body;

  if (!name) return res.status(400).json({ error: 'Name required' });

  if (type === 'permanent') {
    const adminCheck = await isAdmin(req, res, () => {});
    if (!adminCheck) return;
  }

  const existing = await Room.findOne({ name });
  if (existing) {
    return res.status(400).json({ error: 'Room name already exists' });
  }

  const room = await Room.create({
    name,
    type,
    maxParticipants
  });

  res.json(room);
});

/*
  JOIN room
*/
router.post('/join/:roomId', async (req, res) => {
  let session;

  if (TEST_MODE) {
    session = {
      userId: 'test-user',
      fullName: 'Test User'
    };
  } else {
    session = await readSession(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.userId;
  const fullName = session.fullName;

  const room = await Room.findById(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  if (room.participants.length >= room.maxParticipants) {
    return res.status(400).json({ error: 'Room is full' });
  }

  await removeUserFromAllRooms(userId);

  room.participants.push({ userId, fullName });
  await room.save();

  res.json({ message: 'Joined room' });
});

/*
  LEAVE room
*/
router.post('/leave', async (req, res) => {
  let session;

  if (TEST_MODE) {
    session = {
      userId: 'test-user',
      fullName: 'Test User'
    };
  } else {
    session = await readSession(req);
    if (!session) return res.status(401).json({ error: 'Unauthorized' });
  }

  const userId = session.userId;

  await removeUserFromAllRooms(userId);

  res.json({ message: 'Left room' });
});

/*
  DELETE room (Admin only — even if active)
*/
router.delete('/:roomId', isAdmin, async (req, res) => {
  const room = await Room.findById(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  await Room.deleteOne({ _id: room._id });

  res.json({ message: 'Room deleted by admin' });
});

module.exports = router;
