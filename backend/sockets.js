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
      console.log(`User ${userId} joining room ${roomId}`);
      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = userId;
      if (!roomParticipants.has(roomId)) roomParticipants.set(roomId, new Set());
      roomParticipants.get(roomId).add(userId);
      const currentParticipants = Array.from(roomParticipants.get(roomId));
      console.log(`Room ${roomId} now has participants:`, currentParticipants);
      // Notify all in room of new participant list
      io.to(roomId).emit('room-participants', currentParticipants);
    });

    // User leaves a video room
    socket.on('leave-room', ({ roomId, userId }) => {
      console.log(`User ${userId} leaving room ${roomId}`);
      socket.leave(roomId);
      if (roomParticipants.has(roomId)) {
        roomParticipants.get(roomId).delete(userId);
        if (roomParticipants.get(roomId).size === 0) {
          roomParticipants.delete(roomId);
          console.log(`Room ${roomId} deleted - no participants left`);
        } else {
          const currentParticipants = Array.from(roomParticipants.get(roomId));
          console.log(`Room ${roomId} now has participants:`, currentParticipants);
          io.to(roomId).emit('room-participants', currentParticipants);
        }
      }
    });

    // WebRTC signaling for room
    socket.on('signal', ({ roomId, userId, signal }) => {
      console.log(`Relaying signal of type ${signal.type} from user ${userId} to room ${roomId}`);
      // Broadcast to all others in the room except the sender
      socket.to(roomId).emit('signal', { userId, signal });
    });

    // On disconnect, remove from room
    socket.on('disconnect', () => {
      console.log(`Socket ${socket.id} disconnected`);
      const { roomId, userId } = socket;
      
      // Remove from user sockets map
      if (userId) {
        removeUserSocket(userId, socket.id);
      }
      
      // Remove from room participants
      if (roomId && userId && roomParticipants.has(roomId)) {
        console.log(`Removing user ${userId} from room ${roomId}`);
        roomParticipants.get(roomId).delete(userId);
        if (roomParticipants.get(roomId).size === 0) {
          roomParticipants.delete(roomId);
          console.log(`Room ${roomId} deleted - no participants left`);
        } else {
          console.log(`Notifying room ${roomId} of participant update`);
          io.to(roomId).emit('room-participants', Array.from(roomParticipants.get(roomId)));
        }
      }
    });
  });
};