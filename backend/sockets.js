/**
 * Register Socket.IO event handlers.
 * @param {import('socket.io').Server} io
 */
module.exports = function (io) {
  // Store all sockets for each userId
  const userSockets = new Map(); // userId -> Set of socketIds
  const pendingCalls = new Map(); // targetUserId -> {callerId, callerSocketId, roomId}
  const activeCalls = new Set(); // userId pairs in call (as string: `${userA}|${userB}`)

  // Room-based video presence
  const roomParticipants = new Map(); // roomId -> Set of userIds

  function getUserSockets(userId) {
    return userSockets.get(userId) || new Set();
  }

  function setUserSocket(userId, socketId) {
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socketId);
  }

  function removeUserSocket(userId, socketId) {
    if (userSockets.has(userId)) {
      userSockets.get(userId).delete(socketId);
      if (userSockets.get(userId).size === 0) userSockets.delete(userId);
    }
  }

  function isUserInCall(userId) {
    for (const pair of activeCalls) {
      if (pair.split('|').includes(userId)) return true;
    }
    return false;
  }

  io.on('connection', socket => {
    console.log(`New socket connection: ${socket.id} from ${socket.handshake.address}`);
    
    // User identifies themselves with their user ID
    socket.on('register', userId => {
      setUserSocket(userId, socket.id);
      socket.userId = userId;
      console.log(`User ${userId} registered with socket ${socket.id}`);
    });

    // User joins a video room
    socket.on('join-room', ({ roomId, userId }) => {
      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = userId;
      if (!roomParticipants.has(roomId)) roomParticipants.set(roomId, new Set());
      roomParticipants.get(roomId).add(userId);
      // Notify all in room of new participant list
      const participants = Array.from(roomParticipants.get(roomId));
      console.log(`[SOCKETS] join-room: roomId=${roomId}, participants=`, participants);
      io.to(roomId).emit('room-participants', participants);
    });

    // User leaves a video room
    socket.on('leave-room', ({ roomId, userId }) => {
      socket.leave(roomId);
      if (roomParticipants.has(roomId)) {
        roomParticipants.get(roomId).delete(userId);
        if (roomParticipants.get(roomId).size === 0) {
          roomParticipants.delete(roomId);
        } else {
          const participants = Array.from(roomParticipants.get(roomId));
          console.log(`[SOCKETS] leave-room: roomId=${roomId}, participants=`, participants);
          io.to(roomId).emit('room-participants', participants);
        }
      }
    });

    // WebRTC signaling for room
    socket.on('signal', ({ roomId, userId, signal }) => {
      // Broadcast to all others in the room except the sender
      socket.to(roomId).emit('signal', { userId, signal });
    });

    // On disconnect, remove from room
    socket.on('disconnect', () => {
      const { roomId, userId } = socket;
      if (roomId && userId && roomParticipants.has(roomId)) {
        roomParticipants.get(roomId).delete(userId);
        if (roomParticipants.get(roomId).size === 0) {
          roomParticipants.delete(roomId);
        } else {
          io.to(roomId).emit('room-participants', Array.from(roomParticipants.get(roomId)));
        }
      }
    });
  });
};