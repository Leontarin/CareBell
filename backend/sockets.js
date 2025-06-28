// backend/sockets.js
const Room = require('./models/room'); 

module.exports = function (io) {
  const roomParticipants = new Map(); 
  const socketToUser = new Map();
  const socketToRoom = new Map(); 

  async function cleanupUserFromRoom(userId, roomId) {
    if (roomParticipants.has(roomId)) {
      roomParticipants.get(roomId).delete(userId);
      if (roomParticipants.get(roomId).size === 0) {
        roomParticipants.delete(roomId);
      } else {
        const currentParticipants = Array.from(roomParticipants.get(roomId));
        
        const User = require('./models/user');
        const participantDetails = await Promise.all(
          currentParticipants.map(async (userId) => {
            try {
              const user = await User.findOne({ id: userId });
              return {
                userId: userId,
                fullName: user ? user.fullName : `User ${userId.slice(-4)}`
              };
            } catch (error) {
              return {
                userId: userId,
                fullName: `User ${userId.slice(-4)}`
              };
            }
          })
        );
        
        io.to(roomId).emit('room-participants', currentParticipants, participantDetails);
        io.emit('room-participant-count', { roomName: roomId, count: currentParticipants.length });
      }
    }

    try {
      const room = await Room.findOne({ name: roomId });
      if (room) {
        room.participants = room.participants.filter(id => id !== userId);
        if (room.participants.length === 0) {
          if (room.isTemporary) {
            await room.deleteOne();
            io.emit('room-deleted', { name: roomId });
          } else {
            room.isActive = false;
            await room.save();
            
            const User = require('./models/user');
            const participantDetails = await Promise.all(
              room.participants.map(async (userId) => {
                try {
                  const user = await User.findOne({ id: userId });
                  return {
                    userId: userId,
                    fullName: user ? user.fullName : `User ${userId.slice(-4)}`
                  };
                } catch (error) {
                  return {
                    userId: userId,
                    fullName: `User ${userId.slice(-4)}`
                  };
                }
              })
            );
            
            io.emit('room-updated', { ...room.toObject(), participantDetails });
          }
        } else {
          await room.save();
          
          const User = require('./models/user');
          const participantDetails = await Promise.all(
            room.participants.map(async (userId) => {
              try {
                const user = await User.findOne({ id: userId });
                return {
                  userId: userId,
                  fullName: user ? user.fullName : `User ${userId.slice(-4)}`
                };
              } catch (error) {
                return {
                  userId: userId,
                  fullName: `User ${userId.slice(-4)}`
                };
              }
            })
          );
          
          io.emit('room-updated', { ...room.toObject(), participantDetails });
        }
      }
    } catch (error) {
      console.error('❌ Error cleaning up room in DB:', error);
    }
  }

  io.on('connection', socket => {
    
    socket.on('register', userId => {
      socketToUser.set(socket.id, userId);
      socket.userId = userId;

      roomParticipants.forEach((participants, roomName) => {
        socket.emit('room-participant-count', { roomName, count: participants.size });
      });
    });

    socket.on('join-room', async ({ roomId, userId }) => {
      const previousRoom = socketToRoom.get(socket.id);
      if (previousRoom && previousRoom !== roomId) {
        socket.leave(previousRoom);
        cleanupUserFromRoom(userId, previousRoom);
      }
      
      socket.join(roomId);
      socket.roomId = roomId;
      socket.userId = userId;
      socketToRoom.set(socket.id, roomId);

      if (!roomParticipants.has(roomId)) {
        roomParticipants.set(roomId, new Set());
      }
      roomParticipants.get(roomId).add(userId);

      const currentParticipants = Array.from(roomParticipants.get(roomId));
      
      const User = require('./models/user');
      const participantDetails = await Promise.all(
        currentParticipants.map(async (userId) => {
          try {
            const user = await User.findOne({ id: userId });
            return {
              userId: userId,
              fullName: user ? user.fullName : `User ${userId.slice(-4)}`
            };
          } catch (error) {
            return {
              userId: userId,
              fullName: `User ${userId.slice(-4)}`
            };
          }
        })
      );
      
      io.to(roomId).emit('room-participants', currentParticipants, participantDetails);
      io.emit('room-participant-count', { roomName: roomId, count: currentParticipants.length });
    });

    socket.on('leave-room', ({ roomId, userId }) => {
      socket.leave(roomId);
      socketToRoom.delete(socket.id);
      cleanupUserFromRoom(userId, roomId);
    });

    // P2P Signal routing - routes messages between specific peers
    socket.on('p2p-signal', ({ roomId, fromUserId, toUserId, signal }) => {
      try {
        if (!signal || !signal.type) {
          return;
        }
        
        if (!roomParticipants.has(roomId) || 
            !roomParticipants.get(roomId).has(fromUserId) || 
            !roomParticipants.get(roomId).has(toUserId)) {
          return;
        }
        
        const enrichedSignal = {
          ...signal,
          timestamp: Date.now(),
          fromUser: fromUserId
        };
        
        const targetSockets = Array.from(io.sockets.sockets.values())
          .filter(s => s.userId === toUserId && s.roomId === roomId);
        
        targetSockets.forEach(targetSocket => {
          targetSocket.emit('p2p-signal', {
            fromUserId: fromUserId,
            toUserId: toUserId,
            signal: enrichedSignal
          });
        });
        
      } catch (error) {
        console.error('❌ Error handling P2P signal:', error);
      }
    });

    // Add mute state handling
    socket.on('broadcast-mute-state', ({ roomId, userId, signal }) => {
      try {
        console.log(`🔇 MUTE BACKEND: Broadcasting mute state from ${userId} in room ${roomId}: ${signal.isMuted ? 'muted' : 'unmuted'}`);
        
        if (!roomParticipants.has(roomId) || !roomParticipants.get(roomId).has(userId)) {
          console.warn(`⚠️ MUTE BACKEND: User ${userId} not in room ${roomId}, ignoring mute state`);
          return;
        }
        
        console.log(`📡 MUTE BACKEND: Broadcasting to room ${roomId}, participants:`, Array.from(roomParticipants.get(roomId)));
        
        socket.to(roomId).emit('p2p-signal', {
          fromUserId: userId,
          signal: signal
        });
        
        console.log(`✅ MUTE BACKEND: Successfully broadcasted mute state from ${userId} to room ${roomId}`);
      } catch (error) {
        console.error('❌ MUTE BACKEND: Error handling mute state broadcast:', error);
      }
    });

    socket.on('mute-state', ({ roomId, userId, targetUserId, signal }) => {
      try {
        console.log(`🔇 MUTE BACKEND: Routing mute state from ${userId} to ${targetUserId} in room ${roomId}`);
        
        if (!roomParticipants.has(roomId) || 
            !roomParticipants.get(roomId).has(userId) || 
            !roomParticipants.get(roomId).has(targetUserId)) {
          console.warn(`⚠️ MUTE BACKEND: Mute state routing failed - users not in room ${roomId}`);
          return;
        }
        
        const targetSockets = Array.from(io.sockets.sockets.values())
          .filter(s => s.userId === targetUserId && s.roomId === roomId);
        
        targetSockets.forEach(targetSocket => {
          targetSocket.emit('p2p-signal', {
            fromUserId: userId,
            signal: signal
          });
        });
        
        console.log(`✅ MUTE BACKEND: Successfully routed mute state from ${userId} to ${targetUserId}`);
      } catch (error) {
        console.error('❌ MUTE BACKEND: Error handling mute state:', error);
      }
    });

    // Original WebRTC signaling (kept for fallback)
    socket.on('signal', ({ roomId, userId, signal }) => {
      try {
        if (!signal || !signal.type) {
          return;
        }
        
        if (!roomParticipants.has(roomId) || !roomParticipants.get(roomId).has(userId)) {
          return;
        }
        
        const enrichedSignal = {
          ...signal,
          timestamp: Date.now(),
          fromUser: userId
        };
        
        socket.to(roomId).emit('signal', {
          userId: userId,
          signal: enrichedSignal
        });
        
      } catch (error) {
        console.error('❌ Error handling signal:', error);
      }
    });

    socket.on('get-room-participant-count', (roomName) => {
      const count = roomParticipants.has(roomName) ? roomParticipants.get(roomName).size : 0;
      socket.emit('room-participant-count', { roomName, count });
    });

    socket.on('disconnect', () => {
      const userId = socketToUser.get(socket.id);
      const roomId = socketToRoom.get(socket.id);
      
      if (roomId && userId) {
        cleanupUserFromRoom(userId, roomId);
      }
      
      socketToUser.delete(socket.id);
      socketToRoom.delete(socket.id);
    });
  });
};