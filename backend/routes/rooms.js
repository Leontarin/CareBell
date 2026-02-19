// backend/routes/rooms.js
const express = require('express');
const router = express.Router();

const requireUser = require('../middleware/requireUser');
const isAdmin = require('../middleware/isAdmin');

const Room = require('../models/room');
const { asObjectId } = require('../lib/rooms/roomLifecycle');
const { getRoomRoster } = require('../lib/rooms/roster');

function getIo(req) {
  return req.app.get('io');
}

function emitRoomsChanged(io) {
  if (io) io.emit('rooms:changed');
}

function requireActiveSocket(io, userId) {
  const rtc = io?._rtc;
  const s = rtc?.getSocketByUserId?.(userId);
  return s || null;
}

/**
 * GET /rooms
 * Users can view rooms + participants (presence snapshot from DB)
 */
router.get('/', requireUser, async (req, res) => {
  const rooms = await Room.find().lean();

  res.json(
    rooms.map(r => ({
      _id: r._id,
      name: r.name,
      type: r.type,
      maxParticipants: r.maxParticipants,
      participants: r.participants,
      participantsCount: r.participants?.length || 0,
      isActive: (r.participants?.length || 0) > 0,
    }))
  );
});

/**
 * POST /rooms/create
 * Create temporary room and auto-join creator (requires active socket)
 */
router.post('/create', requireUser, async (req, res) => {
  const io = getIo(req);
  const userId = req.user.id;

  const { name, maxParticipants = 8 } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Name required' });

  // Ensure unique room name
  const existing = await Room.findOne({ name: String(name).trim() }).lean();
  if (existing) return res.status(400).json({ error: 'Room name already exists' });

  const room = await Room.create({
    name: String(name).trim(),
    type: 'temporary',
    maxParticipants,
  });

  emitRoomsChanged(io);

  // Auto-join requires an active socket (presence model)
  const sock = requireActiveSocket(io, userId);
  if (!sock) {
    return res.status(409).json({
      error: 'Socket not connected. Open MeetWithFriends (socket) before creating rooms.',
      room,
    });
  }

  const roster = await io._rtc.joinRoomForUserId(userId, room._id);
  const finalRoster = roster || (await getRoomRoster(room._id));

  return res.json({ room, roster: finalRoster });
});

/**
 * POST /rooms/create-permanent (admin)
 */
router.post('/create-permanent', isAdmin, async (req, res) => {
  const io = getIo(req);

  const { name, maxParticipants = 8 } = req.body || {};
  if (!String(name || '').trim()) return res.status(400).json({ error: 'Name required' });

  const existing = await Room.findOne({ name: String(name).trim() }).lean();
  if (existing) return res.status(400).json({ error: 'Room name already exists' });

  const room = await Room.create({
    name: String(name).trim(),
    type: 'permanent',
    maxParticipants,
  });

  emitRoomsChanged(io);
  return res.json({ room });
});

/**
 * POST /rooms/join/:roomId
 * Join requires active socket; REST only triggers socket join.
 */
router.post('/join/:roomId', requireUser, async (req, res) => {
  const io = getIo(req);
  const userId = req.user.id;
  const roomId = req.params.roomId;

  const room = await Room.findById(asObjectId(roomId)).lean();
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const sock = requireActiveSocket(io, userId);
  if (!sock) {
    return res.status(409).json({ error: 'Socket not connected. Connect first, then join.' });
  }

  const roster = await io._rtc.joinRoomForUserId(userId, roomId);
  if (!roster) return res.status(500).json({ error: 'Failed to join room' });

  return res.json({ roster });
});

/**
 * POST /rooms/leave
 * Leave requires active socket; REST only triggers socket leave.
 */
router.post('/leave', requireUser, async (req, res) => {
  const io = getIo(req);
  const userId = req.user.id;

  const sock = requireActiveSocket(io, userId);
  if (!sock) {
    return res.status(409).json({ error: 'Socket not connected. Connect first, then leave.' });
  }

  await io._rtc.leaveRoomForUserId(userId);
  emitRoomsChanged(io);

  return res.json({ ok: true });
});

/*
  DELETE room (Admin only — disconnects all users in that room)
*/
router.delete('/:roomId', isAdmin, async (req, res) => {
  const roomId = String(req.params.roomId);

  const room = await Room.findById(roomId);
  if (!room) return res.status(404).json({ error: 'Room not found' });

  const io = req.app.get('io');

  // 1) Notify + kick sockets from the Socket.IO room (best-effort)
  if (io) {
    try {
      io.to(roomId).emit('rtc:room-deleted', {
        roomId,
        reason: 'Room deleted by admin',
      });
    } catch {}

    // Remove sockets from the room + clear their local server-side roomId
    try {
      if (typeof io.in(roomId).fetchSockets === 'function') {
        const sockets = await io.in(roomId).fetchSockets();
        for (const s of sockets) {
          try { if (s.data?.roomId === roomId) s.data.roomId = null; } catch {}
          try { await s.leave(roomId); } catch {}
        }
      } else if (typeof io.in(roomId).allSockets === 'function') {
        const ids = await io.in(roomId).allSockets();
        for (const id of ids) {
          const s =
            io.of('/').sockets.get(id) ||
            io.sockets?.sockets?.get?.(id);

          if (!s) continue;
          try { if (s.data?.roomId === roomId) s.data.roomId = null; } catch {}
          try { s.leave(roomId); } catch {}
        }
      }
    } catch {}
  }

  // 2) Delete room from DB
  await Room.deleteOne({ _id: room._id });

  // 3) Refresh lobby
  emitRoomsChanged(req);

  res.json({ message: 'Room deleted by admin' });
});
module.exports = router;
