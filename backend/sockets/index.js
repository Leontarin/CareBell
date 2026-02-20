// backend/sockets/index.js

const Room = require('../models/room');
const User = require('../models/user');
const { readSession } = require('../lib/session');
const { removeUserFromAllRooms, asObjectId } = require('../lib/rooms/roomLifecycle');
const { getRoomRoster } = require('../lib/rooms/roster');

// Mediasoup
const { getOrCreateRouter, closeRouter } = require('../rtc/routers');
const { ensurePeer, setPeerRoom, getPeer, closePeer } = require('../rtc/peers');
const { createWebRtcTransport, connectWebRtcTransport } = require('../rtc/transports');

// One active socket per user
const socketByUserId = new Map(); // userId -> socket

// Grace disconnect cleanup (refresh / brief network blip)
// IMPORTANT: reconnect alone does NOT cancel cleanup.
// Only an explicit rtc:join-room within grace cancels cleanup.
const pendingDisconnect = new Map(); // userId -> { timeoutId, roomId }
const DISCONNECT_GRACE_MS = Number(process.env.RTC_DISCONNECT_GRACE_MS || 4000);

// ---------- helpers ----------
function safeEmit(socket, event, payload) {
  try { socket.emit(event, payload); } catch {}
}

async function hydrateFullNameFromDb(userId) {
  const u = await User.findOne({ id: String(userId) }).lean();
  return u?.fullName || null;
}

async function authFromCookie(socket) {
  // cookieParser middleware (io.engine.use(cookieParser())) populates socket.request.cookies
  const sess = readSession(socket.request);
  const uid = sess?.uid || sess?.userId || sess?.id;
  if (!uid) return null;

  const fullName = await hydrateFullNameFromDb(uid);
  if (!fullName) return null;

  return { userId: String(uid), fullName: String(fullName) };
}

function clearPending(userId) {
  const pending = pendingDisconnect.get(userId);
  if (pending) {
    clearTimeout(pending.timeoutId);
    pendingDisconnect.delete(userId);
  }
}

async function joinRoomForSocket(io, socket, roomIdRaw) {
  const userId = socket.data.userId;
  const fullName = socket.data.fullName;

  const nextRoomId = String(roomIdRaw);

  // Any explicit join cancels pending cleanup (no autojoin, but explicit join is allowed)
  clearPending(userId);

  // Ensure room exists
  const exists = await Room.findById(asObjectId(nextRoomId)).lean();
  if (!exists) {
    safeEmit(socket, 'rtc:error', { error: 'Room not found' });
    return null;
  }

  // Enforce one-room-per-user (DB) before anything else
  await removeUserFromAllRooms(userId, nextRoomId);

  // Reload fresh state & capacity
  const fresh = await Room.findById(asObjectId(nextRoomId));
  if (!fresh) {
    safeEmit(socket, 'rtc:error', { error: 'Room not found' });
    return null;
  }

  const alreadyMember = fresh.participants.some(p => p.userId === userId);
  if (!alreadyMember) {
    if (fresh.participants.length >= fresh.maxParticipants) {
      safeEmit(socket, 'rtc:error', { error: 'Room is full' });
      return null;
    }
    fresh.participants.push({ userId, fullName });
    fresh.everHadParticipants = true;
    await fresh.save();
    io.emit('rooms:changed');
  }

  // Socket room switch (presence channel)
  const prevRoomId = socket.data.roomId;
  if (prevRoomId && prevRoomId !== nextRoomId) {
    socket.leave(prevRoomId);
    socket.to(prevRoomId).emit('rtc:user-left', { userId });
  }

  socket.data.roomId = nextRoomId;
  socket.join(nextRoomId);
  // Bind mediasoup peer to room (safe even if not used yet)
  setPeerRoom(socket, nextRoomId);

  const roster = await getRoomRoster(nextRoomId);
  safeEmit(socket, 'rtc:roster', roster);
  socket.to(nextRoomId).emit('rtc:user-joined', { userId, fullName });

  return roster;
}

async function leaveRoomForSocket(io, socket) {
  const userId = socket.data.userId;
  clearPending(userId);

  const curRoomId = socket.data.roomId;
  if (!curRoomId) return true;

  socket.leave(curRoomId);
  socket.data.roomId = null;

  try {
    const changed = await removeUserFromAllRooms(userId);
    if (changed) io.emit('rooms:changed');
  } catch {}

  socket.to(curRoomId).emit('rtc:user-left', { userId });
  return true;
}

async function kickAllFromRoom(io, roomIdRaw, reason = 'Room deleted') {
  const roomId = String(roomIdRaw);

  // Always notify first (best-effort)
  try {
    io.to(roomId).emit('rtc:room-deleted', { roomId, reason });
  } catch {}

  // Then attempt to move sockets out of that room + clear server-side state
  try {
    // Socket.IO v4: fetchSockets() exists
    if (typeof io.in(roomId).fetchSockets === 'function') {
      const sockets = await io.in(roomId).fetchSockets();
      for (const s of sockets) {
        try {
          clearPending(s.data?.userId);
          if (s.data?.roomId === roomId) s.data.roomId = null;
          await s.leave(roomId);
        } catch {}
      }
      return;
    }
  } catch {}

  try {
    // Fallback: allSockets() exists on many setups
    if (typeof io.in(roomId).allSockets === 'function') {
      const ids = await io.in(roomId).allSockets(); // Set of socket ids
      for (const id of ids) {
        const s =
          io.of('/').sockets.get(id) ||
          io.sockets?.sockets?.get?.(id);

        if (!s) continue;
        try {
          clearPending(s.data?.userId);
          if (s.data?.roomId === roomId) s.data.roomId = null;
          s.leave(roomId);
        } catch {}
      }
    }
  } catch {}
}

// ---------- setup ----------
module.exports = function setupSockets(io) {
  // internal API used by REST routes
  io._rtc = {
    getSocketByUserId: (userId) => socketByUserId.get(String(userId)) || null,
    joinRoomForUserId: async (userId, roomId) => {
      const s = socketByUserId.get(String(userId));
      if (!s) return null;
      return joinRoomForSocket(io, s, roomId);
    },
    leaveRoomForUserId: async (userId) => {
      const s = socketByUserId.get(String(userId));
      if (!s) return false;
      return leaveRoomForSocket(io, s);
    },
    kickAllFromRoom,
  };



  // 🔐 AUTH
  io.use(async (socket, next) => {
    try {
      if (process.env.NODE_ENV === 'test') {
        const userId = socket.handshake?.auth?.userId || 'test-user';
        const fullName = socket.handshake?.auth?.fullName || 'Test User';

        socket.data.userId = String(userId);
        socket.data.fullName = String(fullName);
        socket.data.roomId = null;
        return next();
      }

      const session = await authFromCookie(socket);
      if (!session) return next(new Error('Unauthorized'));

      socket.data.userId = session.userId;
      socket.data.fullName = session.fullName;
      socket.data.roomId = null;

      return next();
    } catch {
      return next(new Error('Unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const fullName = socket.data.fullName;

    // One active socket per user
    const existing = socketByUserId.get(userId);
    if (existing && existing.id !== socket.id) {
      safeEmit(existing, 'rtc:kicked', { reason: 'New connection opened' });
      try { existing.disconnect(true); } catch {}
    }
    socketByUserId.set(userId, socket);

    socket.on('rtc:join-room', async ({ roomId }) => {
      if (!roomId) return;
      await joinRoomForSocket(io, socket, roomId);
    });

    socket.on('rtc:leave-room', async () => {
      await leaveRoomForSocket(io, socket);
    });

    // ================= MEDIASOUP =================

    // 1️⃣ RTP Capabilities
    socket.on("rtc:getRtpCapabilities", async (_, cb) => {
      try {
        if (!socket.data.roomId) throw new Error("Not in room");

        const router = await getOrCreateRouter(socket.data.roomId);
        cb?.({ ok: true, rtpCapabilities: router.rtpCapabilities });

      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // 2️⃣ Create Transport
    socket.on("rtc:createWebRtcTransport", async ({ direction }, cb) => {
      try {
        if (!socket.data.roomId) throw new Error("Not in room");

        const peer = ensurePeer(socket);

        const { transport } = await createWebRtcTransport({
          roomId: socket.data.roomId
        });

        peer.transports.set(transport.id, transport);

        transport.on("close", () => {
          peer.transports.delete(transport.id);
        });

        cb?.({
          ok: true,
          transportOptions: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          }
        });

      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // 3️⃣ Connect Transport
    socket.on("rtc:connectWebRtcTransport", async ({ transportId, dtlsParameters }, cb) => {
      try {
        const peer = getPeer(socket);
        if (!peer) throw new Error("Peer not found");

        const transport = peer.transports.get(String(transportId));
        if (!transport) throw new Error("Transport not found");

        await connectWebRtcTransport(transport, dtlsParameters);

        cb?.({ ok: true });

      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    socket.on('disconnect', () => {
      closePeer(socket).catch(() => {});
      const current = socketByUserId.get(userId);
      if (current && current.id === socket.id) socketByUserId.delete(userId);

      const roomId = socket.data.roomId;
      if (!roomId) return;
      if (pendingDisconnect.has(userId)) return;

      const timeoutId = setTimeout(async () => {
        pendingDisconnect.delete(userId);

        // If user didn't explicitly re-join within grace → remove membership
        try {
          const changed = await removeUserFromAllRooms(userId);
          if (changed) io.emit('rooms:changed');
        } catch {}

        try { io.to(roomId).emit('rtc:user-left', { userId }); } catch {}
      }, DISCONNECT_GRACE_MS);

      pendingDisconnect.set(userId, { timeoutId, roomId });
    });

    safeEmit(socket, 'rtc:ready', { userId, fullName });
  });
};
