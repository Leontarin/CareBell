/**
 * Register Socket.IO event handlers.
 * @param {import('socket.io').Server} io
 */
module.exports = function (io) {
  // Store all sockets for each userId
  const userSockets = new Map(); // userId -> Set of socketIds
  const roomParticipants = new Map(); // roomId -> Set of userIds
  const socketToUser = new Map(); // socketId -> userId
  const socketToRoom = new Map(); // socketId -> roomId

  function getUserSockets(userId) {
    return userSockets.get(userId) || new Set();
  }

  function setUserSocket(userId, socketId) {
    if (!userSockets.has(userId)) userSockets.set(userId, new Set());
    userSockets.get(userId).add(socketId);
    socketToUser.set(socketId, userId);
  }

  function removeUserSocket(userId, socketId) {
    if (userSockets.has(userId)) {
      userSockets.get(userId).delete(socketId);
      if (userSockets.get(userId).size === 0) userSockets.delete(userId);
    }
    socketToUser.delete(socketId);
  }

  function cleanupUserFromRoom(userId, roomId) {
    if (roomParticipants.has(roomId)) {
      roomParticipants.get(roomId).delete(userId);
      if (roomParticipants.get(roomId).size === 0) {
        roomParticipants.delete(roomId);
        console.log(`🗑️ Room ${roomId} deleted - no participants left`);
      } else {
        const currentParticipants = Array.from(roomParticipants.get(roomId));
        console.log(`👥 Room ${roomId} now has participants:`, currentParticipants);
        
        // Notify remaining participants
        io.to(roomId).emit('room-participants', currentParticipants);
        
        // Broadcast updated participant count to ALL clients
        io.emit('room-participant-count', { roomName: roomId, count: currentParticipants.length });
      }
    }
  }

  io.on('connection', socket => {
    console.log(`🔌 New socket connection: ${socket.id}`);
    
    // User identifies themselves with their user ID
    socket.on('register', userId => {
      setUserSocket(userId, socket.id);
      socket.userId = userId;
      console.log(`👤 User ${userId} registered with socket ${socket.id}`);

      // Send current participant counts for all rooms to the newly connected user
      roomParticipants.forEach((participants, roomName) => {
        socket.emit('room-participant-count', { roomName, count: participants.size });
      });
    });

    // User joins a video room
    socket.on('join-room', ({ roomId, userId }) => {
      console.log(`🚪 User ${userId} joining room ${roomId}`);
      
      // Clean up any previous room membership for this socket
      const previousRoom = socketToRoom.get(socket.id);
      if (previousRoom && previousRoom !== roomId) {
        socket.leave(previousRoom);
        cleanupUserFromRoom(userId, previousRoom);
      }
      
      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = userId;
      socketToRoom.set(socket.id, roomId);

      // Add to room participants
      if (!roomParticipants.has(roomId)) {
        roomParticipants.set(roomId, new Set());
      }
      roomParticipants.get(roomId).add(userId);

      const currentParticipants = Array.from(roomParticipants.get(roomId));
      console.log(`👥 Room ${roomId} now has participants:`, currentParticipants);
      
      // Notify all in room of updated participant list with a slight delay
      setTimeout(() => {
        io.to(roomId).emit('room-participants', currentParticipants);
        console.log(`📢 Notified room ${roomId} of participants:`, currentParticipants);

        // Broadcast updated participant count to ALL clients
        io.emit('room-participant-count', { roomName: roomId, count: currentParticipants.length });
        console.log(`📊 Broadcasting participant count for room ${roomId}: ${currentParticipants.length}`);
      }, 200); // Small delay to prevent race conditions
    });

    // User leaves a video room
    socket.on('leave-room', ({ roomId, userId }) => {
      console.log(`🚪 User ${userId} leaving room ${roomId}`);
      socket.leave(roomId);
      socketToRoom.delete(socket.id);
      cleanupUserFromRoom(userId, roomId);
    });

    // WebRTC signaling for room
    socket.on('signal', ({ roomId, userId, signal }) => {
      try {
        console.log(`📡 Relaying ${signal.type} signal from user ${userId} to room ${roomId}`);
        
        // Validate signal data
        if (!signal || !signal.type) {
          console.error('❌ Invalid signal received:', signal);
          return;
        }
        
        // Validate that user is actually in the room
        if (!roomParticipants.has(roomId) || !roomParticipants.get(roomId).has(userId)) {
          console.warn(`⚠️ User ${userId} not in room ${roomId}, ignoring signal`);
          return;
        }
        
        // Add metadata to signal
        const enrichedSignal = {
          ...signal,
          timestamp: Date.now(),
          fromUser: userId
        };
        
        // Broadcast to all others in the room except the sender
        socket.to(roomId).emit('signal', {
          userId: userId,
          signal: enrichedSignal
        });
        
        console.log(`✅ Successfully relayed ${signal.type} signal from ${userId} to room ${roomId}`);
      } catch (error) {
        console.error('❌ Error handling signal:', error);
      }
    });

    // Get participant count for a specific room
    socket.on('get-room-participant-count', (roomName) => {
      const count = roomParticipants.has(roomName) ? roomParticipants.get(roomName).size : 0;
      console.log(`📊 Requested participant count for room ${roomName}: ${count}`);
      socket.emit('room-participant-count', { roomName, count });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`🔌 Socket ${socket.id} disconnected`);
      
      const userId = socketToUser.get(socket.id);
      const roomId = socketToRoom.get(socket.id);
      
      // Remove from user sockets map
      if (userId) {
        removeUserSocket(userId, socket.id);
      }
      
      // Remove from room participants
      if (roomId && userId) {
        console.log(`🧹 Cleaning up user ${userId} from room ${roomId}`);
        cleanupUserFromRoom(userId, roomId);
      }
      
      // Clean up socket mappings
      socketToRoom.delete(socket.id);
    });
  });
};