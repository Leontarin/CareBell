// backend/sockets/index.js

const Room = require('../models/room');
const User = require('../models/user');
const { readSession } = require('../lib/session');
const { removeUserFromAllRooms, asObjectId } = require('../lib/rooms/roomLifecycle');
const { getRoomRoster } = require('../lib/rooms/roster');

// Mediasoup
const { getOrCreateRouter, closeRouter } = require('../rtc/routers');
const { ensurePeer, setPeerRoom, getPeer, closePeer, listPeersInRoom, findPeerByProducerId } = require('../rtc/peers');
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

  // Send current media-state snapshot to the joining socket
  try {
    const peersInRoom = listPeersInRoom(nextRoomId);
    const snapshot = peersInRoom.map((p) => ({
      userId: p.userId,
      // fullName is not stored in peer; take from DB roster if needed
      muted: !!p.muted,
      cameraOff: typeof p.cameraOff === "boolean" ? p.cameraOff : true,
    }));
    safeEmit(socket, "rtc:media-snapshot", { peers: snapshot });
  } catch {}

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

  // Clean mediasoup resources on leave
  await closePeer(socket).catch(() => {});
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
    
        if (direction !== "send" && direction !== "recv")
          throw new Error("Invalid direction");
    
        // Strict: only one send + one recv
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
          if (peer.sendTransportId === transport.id) peer.sendTransportId = null;
          if (peer.recvTransportId === transport.id) peer.recvTransportId = null;
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
      
        if (!transportId) throw new Error("Missing transportId");
        if (!dtlsParameters) throw new Error("Missing dtlsParameters");
      
        const tid = String(transportId);
        const transport = peer.transports.get(tid);
      
        if (!transport)
          throw new Error("Transport not found");
      
        // Prevent double connect
        if (transport.appData?.connected)
          throw new Error("Transport already connected");
      
        await connectWebRtcTransport(transport, dtlsParameters);
      
        // Mark as connected
        transport.appData = {
          ...transport.appData,
          connected: true
        };
      
        // Guardrail: cap max incoming bitrate (client -> server)
        // Protects backend from abuse & crazy encodings
        try {
          await transport.setMaxIncomingBitrate(2_000_000); // 2 Mbps cap
        } catch {}
      
        cb?.({ ok: true });
      
      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // 4️⃣ PRODUCE
    socket.on("rtc:produce", async ({ transportId, kind, rtpParameters }, cb) => {
      try {
        const peer = getPeer(socket);
        if (!peer) throw new Error("Peer not found");

        const tid = String(transportId);
        const transport = peer.transports.get(tid);
        if (!transport) throw new Error("Transport not found");

        // Enforce send transport usage
        if (!peer.sendTransportId || peer.sendTransportId !== tid)
          throw new Error("Produce must use send transport");

        // Validate kind
        if (kind !== "audio" && kind !== "video") {
          throw new Error("Invalid kind");
        }

        // Enforce 1 producer per kind
        if (kind === "audio" && peer.audioProducerId) {
          throw new Error("Audio producer already exists");
        }
        if (kind === "video" && peer.videoProducerId) {
          throw new Error("Video producer already exists");
        }

        if (!rtpParameters) {
          throw new Error("Missing rtpParameters");
        }

        const producer = await transport.produce({
          kind,
          rtpParameters,
          appData: {
            roomId: peer.roomId,
            userId: peer.userId,
            fullName: socket.data.fullName,
            kind,
          },
        });

        peer.producers.set(producer.id, producer);
        if (kind === "audio") peer.audioProducerId = producer.id;
        if (kind === "video") peer.videoProducerId = producer.id;

        const cleanupProducer = () => {
          peer.producers.delete(producer.id);
          if (peer.audioProducerId === producer.id) peer.audioProducerId = null;
          if (peer.videoProducerId === producer.id) peer.videoProducerId = null;
        };

        producer.on("transportclose", () => {
          try { producer.close(); } catch {}
          cleanupProducer();
          try {
            socket.to(peer.roomId).emit("rtc:producer-closed", { producerId: producer.id });
          } catch {}
        });

        producer.on("close", () => {
          cleanupProducer();
          try {
            socket.to(peer.roomId).emit("rtc:producer-closed", { producerId: producer.id });
          } catch {}
        });

        // Notify others in room
        socket.to(peer.roomId).emit("rtc:new-producer", {
          producerId: producer.id,
          userId: peer.userId,
          kind
        });
        //VIDEO DEBUG
        console.log("📤 PRODUCE", {
          roomId: peer.roomId,
          userId: peer.userId,
          kind,
          producerId: producer.id,
        });
        cb?.({ ok: true, producerId: producer.id });

      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // 5️⃣ CONSUME
    socket.on("rtc:consume", async ({ producerId, transportId, rtpCapabilities }, cb) => {
      try {
        const peer = getPeer(socket);
        if (!peer) throw new Error("Peer not found");
        if (!peer.roomId) throw new Error("Not in room");
      
        if (!producerId) throw new Error("Missing producerId");
        if (!rtpCapabilities || !rtpCapabilities.codecs)
          throw new Error("Invalid rtpCapabilities");
      
        const tid = String(transportId);
        const transport = peer.transports.get(tid);
        if (!transport) throw new Error("Transport not found");
      
        // Strict recv transport enforcement
        if (!peer.recvTransportId || peer.recvTransportId !== tid)
          throw new Error("Consume must use recv transport");
      
        const router = await getOrCreateRouter(peer.roomId);
      
        // Prevent consuming own producer
        if (peer.producers.has(producerId))
          throw new Error("Cannot consume own producer");
      
        // Prevent duplicate consumer for same producer
        for (const existing of peer.consumers.values()) {
          if (existing.producerId === producerId)
            throw new Error("Already consuming this producer");
        }
      
        if (!router.canConsume({ producerId, rtpCapabilities }))
          throw new Error("Cannot consume");
      
        const consumer = await transport.consume({
          producerId,
          rtpCapabilities,
          paused: false,
        });
        
        console.log("📥 CONSUME", {
          roomId: peer.roomId,
          userId: peer.userId,
          producerId,
          consumerId: consumer.id,
          kind: consumer.kind,
        });

        transport.on("connectionstatechange", (state) => {
          console.log("📥 recv transport state:", state);
        });
      
        peer.consumers.set(consumer.id, consumer);
      
        const cleanupConsumer = () => {
          try { consumer.close(); } catch {}
          peer.consumers.delete(consumer.id);
        };
      
        consumer.on("transportclose", cleanupConsumer);
      
        consumer.on("producerclose", () => {
          cleanupConsumer();
          try {
            socket.emit("rtc:producer-closed", { producerId });
          } catch {}
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

    // 6️⃣ GET EXISTING PRODUCERS (for late joiners)
    socket.on("rtc:getProducers", async (_, cb) => {
      try {
        const peer = getPeer(socket);
        if (!peer || !peer.roomId) throw new Error("Not in room");

        const peersInRoom = listPeersInRoom(peer.roomId);

        // Return producer objects with metadata so frontend can map streams to users
        const producers = [];
        for (const p of peersInRoom) {
          for (const [producerId, producer] of p.producers.entries()) {
            // never include the requester's own producers
            if (p.socketId === peer.socketId) continue;

            const kind = producer?.kind || producer?.appData?.kind || null;

            producers.push({
              producerId,
              userId: p.userId,
              fullName: producer?.appData?.fullName || null,
              kind,
            });
          }
        }

        cb?.({ ok: true, producers });
      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // 7️⃣ OPTIONAL: GET PRODUCER INFO (frontend fallback)
    socket.on("rtc:getProducerInfo", async ({ producerId }, cb) => {
      try {
        if (!producerId) throw new Error("Missing producerId");

        const owner = findPeerByProducerId(String(producerId));
        if (!owner) throw new Error("Producer not found");

        const producer = owner.producers.get(String(producerId));
        const kind = producer?.kind || producer?.appData?.kind || null;

        cb?.({
          ok: true,
          producerId: String(producerId),
          userId: owner.userId,
          fullName: producer?.appData?.fullName || null,
          kind,
        });
      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // 8️⃣ MEDIA STATE SYNC (mute/cameraOff)
    socket.on("rtc:update-media", async ({ muted, cameraOff }, cb) => {
      try {
        const peer = ensurePeer(socket);
        if (!peer.roomId) throw new Error("Not in room");

        if (typeof muted === "boolean") peer.muted = muted;
        if (typeof cameraOff === "boolean") peer.cameraOff = cameraOff;

        // Broadcast to everyone else
        socket.to(peer.roomId).emit("rtc:peer-media", {
          userId: peer.userId,
          fullName: socket.data.fullName,
          muted: peer.muted,
          cameraOff: peer.cameraOff,
        });

        cb?.({ ok: true });
      } catch (err) {
        cb?.({ ok: false, error: err.message });
      }
    });

    // Alias (your frontend sometimes emits rtc:media-state)
    socket.on("rtc:media-state", (payload, cb) => {
      socket.emit("rtc:update-media", payload, cb);
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
        
          // After membership cleanup, close router if room is gone OR empty.
          try {
            const room = await Room.findById(asObjectId(roomId)).lean();
        
            // If temporary room got deleted -> close router
            if (!room) {
              await closeRouter(roomId);
            } else if (room.participants.length === 0) {
              // If room still exists but empty -> close router (also fine for permanent rooms)
              await closeRouter(roomId);
            }
          } catch {}
        } catch {}

        try { io.to(roomId).emit('rtc:user-left', { userId }); } catch {}
      }, DISCONNECT_GRACE_MS);

      pendingDisconnect.set(userId, { timeoutId, roomId });
    });

    safeEmit(socket, 'rtc:ready', { userId, fullName });
  });
};
