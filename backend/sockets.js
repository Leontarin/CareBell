// backend/sockets.js
const Room = require('./models/room'); 

module.exports = function (io) {
  const roomParticipants = new Map(); 
  const socketToUser = new Map();
  const socketToRoom = new Map(); 

  // In backend/sockets.js - Update the cleanupUserFromRoom function
async function cleanupUserFromRoom(userId, roomId) {
  if (roomParticipants.has(roomId)) {
    roomParticipants.get(roomId).delete(userId);
    if (roomParticipants.get(roomId).size === 0) {
      roomParticipants.delete(roomId);
      console.log(`🗑️ Room ${roomId} deleted - no participants left`);
    } else {
      const currentParticipants = Array.from(roomParticipants.get(roomId));
      console.log(`👥 Room ${roomId} now has participants:`, currentParticipants);
      
      // Get participant details
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
      
      // Notify remaining participants with details
      io.to(roomId).emit('room-participants', currentParticipants, participantDetails);
      
      // Broadcast updated participant count to ALL clients
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
          console.log(`🗑️ Database: Temporary room ${roomId} deleted`);
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
          console.log(`💤 Database: Default room ${roomId} marked inactive`);
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
        console.log(`🔄 Database: Room ${roomId} updated`);
      }
    }
  } catch (error) {
    console.error('❌ Error cleaning up room in DB:', error);
  }
}

  io.on('connection', socket => {
    console.log(`🔌 New socket connection: ${socket.id}`);
    
    socket.on('register', userId => {
      socketToUser.set(socket.id, userId);
      socket.userId = userId;
      console.log(`👤 User ${userId} registered with socket ${socket.id}`);

      // Send current participant counts for all rooms
      roomParticipants.forEach((participants, roomName) => {
        socket.emit('room-participant-count', { roomName, count: participants.size });
      });
    });

    socket.on('join-room', async ({ roomId, userId }) => {
  console.log(`🚪 User ${userId} joining room ${roomId}`);
  
  // Clean up any previous room membership
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
  console.log(`👥 Room ${roomId} now has participants:`, currentParticipants);
  
  // FETCH PARTICIPANT DETAILS IMMEDIATELY
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
  
  // Send participants with details immediately
  io.to(roomId).emit('room-participants', currentParticipants, participantDetails);
  console.log(`📢 Notified room ${roomId} of participants with details:`, participantDetails);

  // Broadcast updated participant count to ALL clients
  io.emit('room-participant-count', { roomName: roomId, count: currentParticipants.length });
  console.log(`📊 Broadcasting participant count for room ${roomId}: ${currentParticipants.length}`);
});

    socket.on('leave-room', ({ roomId, userId }) => {
      console.log(`🚪 User ${userId} leaving room ${roomId}`);
      socket.leave(roomId);
      socketToRoom.delete(socket.id);
      cleanupUserFromRoom(userId, roomId);
    });

    // P2P Signal routing - routes messages between specific peers
    socket.on('p2p-signal', ({ roomId, fromUserId, toUserId, signal }) => {
      try {
        console.log(`📡 Routing P2P ${signal.type} signal from ${fromUserId} to ${toUserId} in room ${roomId}`);
        
        // Validate signal data
        if (!signal || !signal.type) {
          console.error('❌ Invalid P2P signal received:', signal);
          return;
        }
        
        // Validate that both users are in the room
        if (!roomParticipants.has(roomId) || 
            !roomParticipants.get(roomId).has(fromUserId) || 
            !roomParticipants.get(roomId).has(toUserId)) {
          console.warn(`⚠️ P2P signal routing failed - users not in room ${roomId}`);
          return;
        }
        
        // Add metadata to signal
        const enrichedSignal = {
          ...signal,
          timestamp: Date.now(),
          fromUser: fromUserId
        };
        
        // Send signal to specific target user only
        const targetSockets = Array.from(io.sockets.sockets.values())
          .filter(s => s.userId === toUserId && s.roomId === roomId);
        
        targetSockets.forEach(targetSocket => {
          targetSocket.emit('p2p-signal', {
            fromUserId: fromUserId,
            toUserId: toUserId,
            signal: enrichedSignal
          });
        });
        
        console.log(`✅ Successfully routed P2P ${signal.type} signal from ${fromUserId} to ${toUserId}`);
      } catch (error) {
        console.error('❌ Error handling P2P signal:', error);
      }
    });

    // Add mute state handling
    socket.on('broadcast-mute-state', ({ roomId, userId, signal }) => {
  try {
    console.log(`🔇 [BACKEND] Broadcasting mute state from ${userId} in room ${roomId}: ${signal.isMuted ? 'muted' : 'unmuted'}`);
    
    if (!roomParticipants.has(roomId) || !roomParticipants.get(roomId).has(userId)) {
      console.warn(`⚠️ [BACKEND] User ${userId} not in room ${roomId}, ignoring mute state`);
      return;
    }
    
    console.log(`📡 [BACKEND] Broadcasting to room ${roomId}, participants:`, Array.from(roomParticipants.get(roomId)));
    
    // Broadcast to all other participants in the room
    socket.to(roomId).emit('p2p-signal', {
      fromUserId: userId,
      signal: signal
    });
    
    console.log(`✅ [BACKEND] Successfully broadcasted mute state from ${userId} to room ${roomId}`);
  } catch (error) {
    console.error('❌ [BACKEND] Error handling mute state broadcast:', error);
  }
});

    socket.on('mute-state', ({ roomId, userId, targetUserId, signal }) => {
      try {
        console.log(`🔇 Routing mute state from ${userId} to ${targetUserId} in room ${roomId}`);
        
        if (!roomParticipants.has(roomId) || 
            !roomParticipants.get(roomId).has(userId) || 
            !roomParticipants.get(roomId).has(targetUserId)) {
          console.warn(`⚠️ Mute state routing failed - users not in room ${roomId}`);
          return;
        }
        
        // Send to specific target user
        const targetSockets = Array.from(io.sockets.sockets.values())
          .filter(s => s.userId === targetUserId && s.roomId === roomId);
        
        targetSockets.forEach(targetSocket => {
          targetSocket.emit('p2p-signal', {
            fromUserId: userId,
            signal: signal
          });
        });
        
        console.log(`✅ Successfully routed mute state from ${userId} to ${targetUserId}`);
      } catch (error) {
        console.error('❌ Error handling mute state:', error);
      }
    });

    // Original WebRTC signaling (kept for fallback)
    socket.on('signal', ({ roomId, userId, signal }) => {
      try {
        console.log(`📡 Relaying ${signal.type} signal from user ${userId} to room ${roomId}`);
        
        if (!signal || !signal.type) {
          console.error('❌ Invalid signal received:', signal);
          return;
        }
        
        if (!roomParticipants.has(roomId) || !roomParticipants.get(roomId).has(userId)) {
         console.warn(`⚠️ User ${userId} not in room ${roomId}, ignoring signal`);
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
       
       console.log(`✅ Successfully relayed ${signal.type} signal from ${userId} to room ${roomId}`);
     } catch (error) {
       console.error('❌ Error handling signal:', error);
     }
   });

   socket.on('get-room-participant-count', (roomName) => {
     const count = roomParticipants.has(roomName) ? roomParticipants.get(roomName).size : 0;
     console.log(`📊 Requested participant count for room ${roomName}: ${count}`);
     socket.emit('room-participant-count', { roomName, count });
   });

   socket.on('disconnect', () => {
     console.log(`🔌 Socket ${socket.id} disconnected`);
     
     const userId = socketToUser.get(socket.id);
     const roomId = socketToRoom.get(socket.id);
     
     if (roomId && userId) {
       console.log(`🧹 Cleaning up user ${userId} from room ${roomId}`);
       cleanupUserFromRoom(userId, roomId);
     }
     
     socketToUser.delete(socket.id);
     socketToRoom.delete(socket.id);
   });
 });
};