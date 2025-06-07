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

      if (!roomParticipants.has(roomId)) {
        roomParticipants.set(roomId, new Set());
      }
      roomParticipants.get(roomId).add(userId);

      const currentParticipants = Array.from(roomParticipants.get(roomId));
      console.log(`Room ${roomId} now has participants:`, currentParticipants);
      
      // Add a small delay before notifying participants to prevent race conditions
      setTimeout(() => {
        // Notify all in room of new participant list
        io.to(roomId).emit('room-participants', currentParticipants);
        console.log(`Notified room ${roomId} of updated participants:`, currentParticipants);

        // Broadcast updated participant count to all clients
        io.emit('room-participant-count', { roomName: roomId, count: currentParticipants.length });
      }, 100); // 100ms delay
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

          // Broadcast updated participant count to all clients
          io.emit('room-participant-count', { roomName: roomId, count: currentParticipants.length });
        }
      }
    });

    // WebRTC signaling for room with improved handling
    socket.on('signal', ({ roomId, userId, signal }) => {
      try {
        console.log(`Relaying signal of type ${signal.type} from user ${userId} to room ${roomId}`);
        
        // Validate signal data
        if (!signal || !signal.type) {
          console.error('Invalid signal received:', signal);
          return;
        }
        
        // Validate that user is actually in the room
        if (!roomParticipants.has(roomId) || !roomParticipants.get(roomId).has(userId)) {
          console.warn(`User ${userId} not in room ${roomId}, ignoring signal`);
          return;
        }
        
        // Add timestamp to signal for debugging
        const timestampedSignal = {
          ...signal,
          timestamp: Date.now(),
          fromUser: userId
        };
        
        // Broadcast to all others in the room except the sender
        socket.to(roomId).emit('signal', {
          userId: userId,
          signal: timestampedSignal
        });
        
        console.log(`Successfully relayed ${signal.type} signal from ${userId} to room ${roomId}`);
      } catch (error) {
        console.error('Error handling signal:', error);
      }
    });

    // Get participant count for a specific room
    socket.on('get-room-participant-count', (roomName) => {
      const count = roomParticipants.has(roomName) ? roomParticipants.get(roomName).size : 0;
      console.log(`Requested participant count for room ${roomName}: ${count}`);
      console.log('Current room participants map:', Array.from(roomParticipants.entries()));
      socket.emit('room-participant-count', { roomName, count });
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
          const currentParticipants = Array.from(roomParticipants.get(roomId));
          io.to(roomId).emit('room-participants', currentParticipants);

          // Broadcast updated participant count to all clients
          io.emit('room-participant-count', { roomName: roomId, count: currentParticipants.length });
        }
      }
    });
  });
};