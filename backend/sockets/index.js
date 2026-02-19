// backend/sockets/index.js
const { readSession } = require('../lib/session');
const { removeUserFromAllRooms } = require('../lib/rooms/roomLifecycle');
const { getRoomRoster } = require('../lib/rooms/roster');

function getSessionForSocket(socket) {
  if (process.env.NODE_ENV !== 'test') return null;

  // In tests we pass identity via socket.handshake.auth
  const userId = socket.handshake?.auth?.userId || 'test-user';
  const fullName = socket.handshake?.auth?.fullName || 'Test User';
  return { userId, fullName };
}

// One active socket per user
const socketByUserId = new Map(); // userId -> socket

module.exports = function setupSockets(io) {
  io.on('connection', async (socket) => {
    let userId = null;
    let fullName = null;

    try {
      let session = getSessionForSocket(socket);

      if (!session) {
        const maybePromise = readSession(socket.request);
        session = (maybePromise && typeof maybePromise.then === 'function')
          ? await maybePromise
          : maybePromise;
      }

      userId = session?.userId || session?.uid;
      fullName = session?.fullName || '';

      if (!userId) {
        socket.emit('rtc:error', { error: 'Unauthorized' });
        return socket.disconnect(true);
      }

      // Enforce one active connection per user
      const existing = socketByUserId.get(userId);
      if (existing && existing.id !== socket.id) {
        try { existing.emit('rtc:kicked', { reason: 'New connection opened' }); } catch {}
        try { existing.disconnect(true); } catch {}
      }
      socketByUserId.set(userId, socket);

      socket.data.userId = userId;
      socket.data.fullName = fullName;
      socket.data.roomId = null;

      // Presence only (DB membership remains REST-authoritative)
      socket.on('rtc:join-room', async ({ roomId }) => {
        if (!roomId) return;

        const nextRoomId = String(roomId);

        if (socket.data.roomId && socket.data.roomId !== nextRoomId) {
          socket.leave(socket.data.roomId);
          socket.to(socket.data.roomId).emit('rtc:user-left', { userId });
        }

        socket.data.roomId = nextRoomId;
        socket.join(nextRoomId);

        const roster = await getRoomRoster(nextRoomId);
        if (!roster) {
          socket.emit('rtc:error', { error: 'Room not found' });
          return;
        }

        socket.emit('rtc:roster', roster);

        socket.to(nextRoomId).emit('rtc:user-joined', { userId, fullName });
      });

      socket.on('rtc:leave-room', async () => {
        const roomId = socket.data.roomId;
        if (!roomId) return;

        socket.leave(roomId);
        socket.data.roomId = null;

        socket.to(roomId).emit('rtc:user-left', { userId });
      });

      socket.on('disconnect', async () => {
        // Remove from map if this was the active socket
        const cur = socketByUserId.get(userId);
        if (cur && cur.id === socket.id) socketByUserId.delete(userId);

        // Authoritative cleanup: remove user from DB rooms on disconnect
        try {
          const changed = await removeUserFromAllRooms(userId);
          if (changed) io.emit('rooms:changed');
        } catch (e) {
          // keep server stable; no console spam
        }

        const roomId = socket.data.roomId;
        if (roomId) {
          try { socket.to(roomId).emit('rtc:user-left', { userId }); } catch {}
        }
      });

      socket.emit('rtc:ready', { userId, fullName });
    } catch (_err) {
      try { socket.disconnect(true); } catch {}
    }
  });
};
