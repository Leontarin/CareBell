// P2P Video Signaling Server for Deno Deploy
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

// Store active rooms and connections
const rooms = new Map();
const userToSocket = new Map();

function broadcastToRoom(roomId, message, excludeUserId) {
  const room = rooms.get(roomId);
  if (!room) return;

  room.forEach((socket, userId) => {
    if (userId !== excludeUserId && socket.readyState === WebSocket.OPEN) {
      try {
        socket.send(JSON.stringify(message));
      } catch (error) {
        console.error(`Failed to send message to ${userId}:`, error);
        room.delete(userId);
        userToSocket.delete(userId);
      }
    }
  });
}

function addUserToRoom(roomId, userId, socket) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  
  const room = rooms.get(roomId);
  room.set(userId, socket);
  userToSocket.set(userId, socket);
  
  console.log(`✅ User ${userId} joined room ${roomId}. Room size: ${room.size}`);
  
  const participants = Array.from(room.keys());
  broadcastToRoom(roomId, {
    type: 'room-participants',
    participants: participants,
    newUser: userId
  });
}

function removeUserFromRoom(roomId, userId) {
  const room = rooms.get(roomId);
  if (!room) return;
  
  room.delete(userId);
  userToSocket.delete(userId);
  
  console.log(`❌ User ${userId} left room ${roomId}. Room size: ${room.size}`);
  
  if (room.size === 0) {
    rooms.delete(roomId);
    console.log(`🗑️ Room ${roomId} deleted (empty)`);
  } else {
    const participants = Array.from(room.keys());
    broadcastToRoom(roomId, {
      type: 'room-participants',
      participants: participants,
      leftUser: userId
    });
  }
}

function handleWebSocket(socket) {
  let currentUserId = null;
  let currentRoomId = null;

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      data.timestamp = Date.now();

      console.log(`📡 Received: ${data.type} from ${data.userId} in room ${data.roomId}`);

      switch (data.type) {
        case 'join-room':
          currentUserId = data.userId;
          currentRoomId = data.roomId;
          addUserToRoom(data.roomId, data.userId, socket);
          break;

        case 'leave-room':
          if (currentRoomId && currentUserId) {
            removeUserFromRoom(currentRoomId, currentUserId);
          }
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
          if (data.targetUserId) {
            const targetSocket = userToSocket.get(data.targetUserId);
            if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
              targetSocket.send(JSON.stringify({
                type: 'p2p-signal',
                fromUserId: data.userId,
                toUserId: data.targetUserId,
                signal: {
                  type: data.type,
                  ...data.signal
                }
              }));
              console.log(`🔄 Routed ${data.type} from ${data.userId} to ${data.targetUserId}`);
            } else {
              console.warn(`⚠️ Target user ${data.targetUserId} not found or disconnected`);
            }
          } else {
            broadcastToRoom(data.roomId, {
              type: 'p2p-signal',
              fromUserId: data.userId,
              signal: {
                type: data.type,
                ...data.signal
              }
            }, data.userId);
          }
          break;

        default:
          console.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  };

  socket.onclose = () => {
    console.log(`🔌 WebSocket closed for user ${currentUserId}`);
    if (currentRoomId && currentUserId) {
      removeUserFromRoom(currentRoomId, currentUserId);
    }
  };

  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };

  socket.send(JSON.stringify({
    type: 'connected',
    message: 'P2P Signaling Server Connected! 🚀'
  }));
}

serve((req) => {
  const url = new URL(req.url);
  
  if (req.headers.get("upgrade") === "websocket") {
    const { socket, response } = Deno.upgradeWebSocket(req);
    handleWebSocket(socket);
    return response;
  }

  if (url.pathname === "/") {
    return new Response(`
      🔗 P2P Video Signaling Server
      
      Status: Running ✅
      Active Rooms: ${rooms.size}
      Connected Users: ${userToSocket.size}
      
      WebSocket Endpoint: wss://${req.headers.get('host')}
      
      For P2P video calls only.
    `, {
      headers: { "content-type": "text/plain" }
    });
  }

  if (url.pathname === "/health") {
    return new Response(JSON.stringify({
      status: "healthy",
      activeRooms: rooms.size,
      connectedUsers: userToSocket.size,
      timestamp: new Date().toISOString()
    }), {
      headers: { "content-type": "application/json" }
    });
  }

  if (url.pathname === "/stats") {
    const roomStats = Array.from(rooms.entries()).map(([roomId, users]) => ({
      roomId,
      userCount: users.size,
      users: Array.from(users.keys())
    }));

    return new Response(JSON.stringify({
      totalRooms: rooms.size,
      totalUsers: userToSocket.size,
      rooms: roomStats
    }), {
      headers: { "content-type": "application/json" }
    });
  }

  return new Response("Not Found", { status: 404 });
});

console.log("🚀 P2P Signaling Server starting...");
console.log("📡 WebSocket endpoint ready for P2P video calls");