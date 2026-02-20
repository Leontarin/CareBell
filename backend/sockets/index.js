// backend/sockets/index.js

// Room require
const Room = require('../models/room');
const User = require('../models/user');
const { readSession } = require('../lib/session');
const { removeUserFromAllRooms, asObjectId } = require('../lib/rooms/roomLifecycle');
const { getRoomRoster } = require('../lib/rooms/roster');

// Mediasoup require
const { getOrCreateRouter, closeRouter } = require("../rtc/routers");
const { ensurePeer, setPeerRoom, getPeer, closePeer } = require("../rtc/peers");
const { createWebRtcTransport, connectWebRtcTransport } = require("../rtc/transports");

// One active socket per user
const socketByUserId = new Map();

// Grace disconnect cleanup
const pendingDisconnect = new Map();
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

// ---------- ROOM JOIN ----------
async function joinRoomForSocket(io, socket, roomIdRaw) {
  const userId = socket.data.userId;
  const fullName = socket.data.fullName;
  const nextRoomId = String(roomIdRaw);

  clearPending(userId);

  const exists = await Room.findById(asObjectId(nextRoomId)).lean();
  if (!exists) {
    safeEmit(socket, 'rtc:error', { error: 'Room not found' });
    return null;
  }

  await removeUserFromAllRooms(userId, nextRoomId);

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

  const prevRoomId = socket.data.roomId;
  if (prevRoomId && prevRoomId !== nextRoomId) {
    socket.leave(prevRoomId);
    socket.to(prevRoomId).emit('rtc:user-left', { userId });
  }

  socket.data.roomId = nextRoomId;
  socket.join(nextRoomId);

  setPeerRoom(socket, nextRoomId);

  const roster = await getRoomRoster(nextRoomId);
  safeEmit(socket, 'rtc:roster', roster);
  socket.to(nextRoomId).emit('rtc:user-joined', { userId, fullName });

  // Inform late joiner about existing producers
  for (const [, otherSocket] of socketByUserId) {
    if (otherSocket.id === socket.id) continue;
    if (otherSocket.data.roomId !== nextRoomId) continue;

    const otherPeer = getPeer(otherSocket);
    if (!otherPeer) continue;

    for (const producer of otherPeer.producers.values()) {
      safeEmit(socket, "rtc:new-producer", {
        producerId: producer.id,
        userId: otherPeer.userId,
        kind: producer.kind,
      });
    }
  }

  return roster;
}

// ---------- SETUP ----------
module.exports = function setupSockets(io) {

  io.use(async (socket, next) => {
    try {
      if (process.env.NODE_ENV === 'test') {
        socket.data.userId = socket.handshake?.auth?.userId || 'test-user';
        socket.data.fullName = socket.handshake?.auth?.fullName || 'Test User';
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

    const existing = socketByUserId.get(userId);
    if (existing && existing.id !== socket.id) {
      safeEmit(existing, 'rtc:kicked', { reason: 'New connection opened' });
      try { existing.disconnect(true); } catch {}
    }
    socketByUserId.set(userId, socket);

    // ---------- ROOM ----------
    socket.on('rtc:join-room', async ({ roomId }) => {
      if (!roomId) return;
      await joinRoomForSocket(io, socket, roomId);
    });

    // ---------- MEDIASOUP ----------

    socket.on("rtc:getRtpCapabilities", async (_, cb) => {
      try {
        if (!socket.data.roomId) throw new Error("Not in room");
        const router = await getOrCreateRouter(socket.data.roomId);
        cb?.({ ok: true, rtpCapabilities: router.rtpCapabilities });
      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    socket.on("rtc:createWebRtcTransport", async ({ direction }, cb) => {
      try {
        if (!socket.data.roomId) throw new Error("Not in room");

        const peer = ensurePeer(socket);

        if (direction === "send" && peer.sendTransportId)
          throw new Error("Send transport already exists");
        if (direction === "recv" && peer.recvTransportId)
          throw new Error("Recv transport already exists");

        const { transport } = await createWebRtcTransport({
          roomId: socket.data.roomId
        });

        peer.transports.set(transport.id, transport);

        if (direction === "send") peer.sendTransportId = transport.id;
        if (direction === "recv") peer.recvTransportId = transport.id;

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

    // ---------- PRODUCE ----------
    socket.on("rtc:produce", async ({ transportId, kind, rtpParameters }, cb) => {
      try {
        const peer = getPeer(socket);
        if (!peer) throw new Error("Peer not found");

        const tid = String(transportId);
        const transport = peer.transports.get(tid);
        if (!transport) throw new Error("Transport not found");

        if (!peer.sendTransportId || peer.sendTransportId !== tid)
          throw new Error("Produce must use send transport");

        const producer = await transport.produce({ kind, rtpParameters });
        peer.producers.set(producer.id, producer);

        const notifyClose = () => {
          peer.producers.delete(producer.id);
          socket.to(peer.roomId).emit("rtc:producer-closed", {
            producerId: producer.id
          });
        };

        producer.on("transportclose", notifyClose);
        producer.on("close", notifyClose);

        socket.to(peer.roomId).emit("rtc:new-producer", {
          producerId: producer.id,
          userId: peer.userId,
          kind
        });

        cb?.({ ok: true, producerId: producer.id });

      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // ---------- CONSUME ----------
    socket.on("rtc:consume", async ({ producerId, transportId, rtpCapabilities }, cb) => {
      try {
        const peer = getPeer(socket);
        if (!peer) throw new Error("Peer not found");

        const tid = String(transportId);
        const transport = peer.transports.get(tid);
        if (!transport) throw new Error("Transport not found");

        if (!peer.recvTransportId || peer.recvTransportId !== tid)
          throw new Error("Consume must use recv transport");

        const router = await getOrCreateRouter(peer.roomId);

        if (!router.canConsume({ producerId, rtpCapabilities }))
          throw new Error("Cannot consume");

        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: false,
        });

        peer.consumers.set(consumer.id, consumer);

        consumer.on("transportclose", () => {
          consumer.close();
          peer.consumers.delete(consumer.id);
        });

        cb?.({
          ok: true,
          consumerParameters: {
            id: consumer.id,
            producerId,
            kind: consumer.kind,
            rtpParameters: consumer.rtpParameters,
          }
        });

      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // ---------- DISCONNECT ----------
    socket.on('disconnect', async () => {
      await closePeer(socket).catch(() => {});

      const current = socketByUserId.get(userId);
      if (current && current.id === socket.id)
        socketByUserId.delete(userId);

      const roomId = socket.data.roomId;
      if (!roomId) return;
      if (pendingDisconnect.has(userId)) return;

      const timeoutId = setTimeout(async () => {
        pendingDisconnect.delete(userId);

        try {
          const changed = await removeUserFromAllRooms(userId);
          if (changed) io.emit('rooms:changed');

          const room = await Room.findById(asObjectId(roomId)).lean();
          if (room && room.participants.length === 0) {
            await closeRouter(roomId);
          }
        } catch {}

        try {
          io.to(roomId).emit('rtc:user-left', { userId });
        } catch {}

      }, DISCONNECT_GRACE_MS);

      pendingDisconnect.set(userId, { timeoutId, roomId });
    });

    safeEmit(socket, 'rtc:ready', {
      userId: socket.data.userId,
      fullName: socket.data.fullName
    });
  });
};