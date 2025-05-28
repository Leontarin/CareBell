/**
 * Register Socket.IO event handlers.
 * @param {import('socket.io').Server} io
 */
module.exports = function (io) {
  // Store all sockets for each userId
  const userSockets = new Map(); // userId -> Set of socketIds
  const pendingCalls = new Map(); // targetUserId -> {callerId, callerSocketId, roomId}
  const activeCalls = new Set(); // userId pairs in call (as string: `${userA}|${userB}`)

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

    // User initiates a call to another user
    socket.on('call-user', targetUserId => {
      const callerUserId = socket.userId;
      if (!callerUserId || !targetUserId) return;
      // If target is in a call, do not ring
      if (isUserInCall(targetUserId)) {
        socket.emit('call-busy', { targetUserId });
        return;
      }
      // Mark as pending call
      pendingCalls.set(targetUserId, {
        callerId: callerUserId,
        callerSocketId: socket.id,
        roomId: null
      });
      // Ring all sockets for the target user
      for (const targetSocketId of getUserSockets(targetUserId)) {
        io.to(targetSocketId).emit('incoming-call', { callerId: callerUserId });
      }
      // Caller gets confirmation
      socket.emit('call-pending', { targetUserId });
    });

    // Target user accepts the call
    socket.on('accept-call', () => {
      const targetUserId = socket.userId;
      if (!pendingCalls.has(targetUserId)) return;
      const { callerId, callerSocketId } = pendingCalls.get(targetUserId);
      // Mark both users as in call
      const roomId = `${callerId}-${targetUserId}-${Date.now()}`;
      activeCalls.add([callerId, targetUserId].sort().join('|'));
      pendingCalls.set(targetUserId, { callerId, callerSocketId, roomId });
      // Join both users to the same room
      socket.join(roomId);
      const callerSocket = io.sockets.sockets.get(callerSocketId);
      if (callerSocket) {
        callerSocket.join(roomId);
        console.log(`Both users joined room ${roomId}: caller ${callerId}, target ${targetUserId}`);
      } else {
        console.error(`Caller socket not found: ${callerSocketId}`);
      }
      // Notify all sockets of target user: call answered (except this one)
      for (const targetSocketId of getUserSockets(targetUserId)) {
        if (targetSocketId !== socket.id) {
          io.to(targetSocketId).emit('call-declined', { reason: 'answered elsewhere' });
        }
      }
      // Notify caller and this target socket
      io.to(callerSocketId).emit('call-accepted', { roomId });
      socket.emit('call-connected', { roomId });
      // Initiate WebRTC connection
      io.to(callerSocketId).emit('initiate-peer', { roomId });
      // Remove from pending calls
      pendingCalls.delete(targetUserId);
    });

    // Target user rejects the call
    socket.on('reject-call', () => {
      const targetUserId = socket.userId;
      if (pendingCalls.has(targetUserId)) {
        const { callerSocketId } = pendingCalls.get(targetUserId);
        io.to(callerSocketId).emit('call-rejected');
        pendingCalls.delete(targetUserId);
      }
    });

    // End call (either user)
    socket.on('end-call', ({ otherUserId }) => {
      const userId = socket.userId;
      if (!userId || !otherUserId) return;
      const pairKey = [userId, otherUserId].sort().join('|');
      if (activeCalls.has(pairKey)) {
        activeCalls.delete(pairKey);
        // Notify all sockets of both users
        for (const sId of [...getUserSockets(userId), ...getUserSockets(otherUserId)]) {
          io.to(sId).emit('call-ended');
        }
      }
    });

    // WebRTC signaling
    socket.on('signal', data => {
      const { roomId, signal } = data;
      console.log(`Signal received from ${socket.userId}, roomId: ${roomId}, type: ${signal?.type}`);
      
      if (roomId && signal) {
        console.log(`Broadcasting signal to room ${roomId}`);
        socket.to(roomId).emit('signal', { signal, roomId });
      } else {
        console.error('Invalid signal data:', data);
      }
    });

    socket.on('disconnect', reason => {
      const userId = socket.userId;
      if (userId) {
        removeUserSocket(userId, socket.id);
        // If user was in a call, end it for all
        for (const pair of Array.from(activeCalls)) {
          if (pair.split('|').includes(userId)) {
            const [userA, userB] = pair.split('|');
            for (const sId of [...getUserSockets(userA), ...getUserSockets(userB)]) {
              io.to(sId).emit('call-ended');
            }
            activeCalls.delete(pair);
          }
        }
      }
    });
  });
};