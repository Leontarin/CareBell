// backend/sockets/index.js

const { readSession } = require('../lib/session');
const { removeUserFromAllRooms } = require('../lib/rooms/roomLifecycle');
const { getRoomRoster } = require('../lib/rooms/roster');

// One active socket per user
const socketByUserId = new Map(); // userId -> socket

module.exports = function setupSockets(io) {

  /**
   * 🔐 AUTH MIDDLEWARE
   * Runs BEFORE "connection"
   * Rejects unauthorized sockets early.
   */
  io.use(async (socket, next) => {
    try {
      let session = null;

      // ✅ Test mode override
      if (process.env.NODE_ENV === 'test') {
        const userId = socket.handshake?.auth?.userId || 'test-user';
        const fullName = socket.handshake?.auth?.fullName || 'Test User';
        session = { userId, fullName };
      } else {
        // Production session resolution
        const maybePromise = readSession(socket.request);
        session =
          maybePromise && typeof maybePromise.then === 'function'
            ? await maybePromise
            : maybePromise;
      }

      const userId = session?.userId || session?.uid;
      const fullName = session?.fullName || '';

      if (!userId) {
        return next(new Error('Unauthorized'));
      }

      // Attach identity to socket
      socket.data.userId = userId;
      socket.data.fullName = fullName;
      socket.data.roomId = null;

      return next();
    } catch (err) {
      return next(new Error('Unauthorized'));
    }
  });

  /**
   * 🔌 CONNECTION HANDLER
   * At this point authentication is guaranteed.
   */
  io.on('connection', (socket) => {
    const userId = socket.data.userId;
    const fullName = socket.data.fullName;

    try {
      /**
       * 🔁 Enforce ONE active connection per user
       */
      const existing = socketByUserId.get(userId);
      if (existing && existing.id !== socket.id) {
        try {
          existing.emit('rtc:kicked', { reason: 'New connection opened' });
        } catch {}
        try {
          existing.disconnect(true);
        } catch {}
      }

      socketByUserId.set(userId, socket);

      /**
       * 🟢 PRESENCE: JOIN ROOM
       * (DB membership remains REST-authoritative)
       */
      socket.on('rtc:join-room', async ({ roomId }) => {
        if (!roomId) return;

        const nextRoomId = String(roomId);

        // If switching rooms
        if (socket.data.roomId && socket.data.roomId !== nextRoomId) {
          socket.leave(socket.data.roomId);
          socket.to(socket.data.roomId).emit('rtc:user-left', { userId });
        }

        // Load roster FIRST
        const roster = await getRoomRoster(nextRoomId);
        if (!roster) {
        socket.emit('rtc:error', { error: 'Room not found' });
        return;
        }

        // 🚨 Enforce DB membership
        const isMember = Array.isArray(roster.participants) &&
        roster.participants.some(p => p.userId === userId);

        if (!isMember) {
        socket.emit('rtc:error', { error: 'Not a room member' });
        return;
        }

        // If switching rooms
        if (socket.data.roomId && socket.data.roomId !== nextRoomId) {
        socket.leave(socket.data.roomId);
        socket.to(socket.data.roomId).emit('rtc:user-left', { userId });
        }

        // Now safe to join
        socket.data.roomId = nextRoomId;
        socket.join(nextRoomId);

        // Send roster to self
        socket.emit('rtc:roster', roster);

        // Notify others
        socket.to(nextRoomId).emit('rtc:user-joined', { userId, fullName });
      });

      /**
       * 🟡 PRESENCE: LEAVE ROOM
       */
      socket.on('rtc:leave-room', async () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;

        socket.leave(roomId);
        socket.data.roomId = null;

        socket.to(roomId).emit('rtc:user-left', { userId });
      });

      /**
       * 🔴 DISCONNECT
       * Authoritative DB cleanup + presence cleanup
       */
      socket.on('disconnect', async () => {
        const current = socketByUserId.get(userId);
        if (current && current.id === socket.id) {
          socketByUserId.delete(userId);
        }

        try {
          const changed = await removeUserFromAllRooms(userId);
          if (changed) io.emit('rooms:changed');
        } catch {
          // keep server stable
        }

        const roomId = socket.data.roomId;
        if (roomId) {
          try {
            socket.to(roomId).emit('rtc:user-left', { userId });
          } catch {}
        }
      });

      /**
       * ✅ Ready signal
       */
      socket.emit('rtc:ready', { userId, fullName });

    } catch {
      try {
        socket.disconnect(true);
      } catch {}
    }
  });
};
