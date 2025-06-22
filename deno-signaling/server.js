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

  // Send welcome message immediately
  try {
    socket.send(JSON.stringify({
      type: 'connected',
      message: 'P2P Signaling Server Connected! 🚀',
      timestamp: Date.now()
    }));
  } catch (error) {
    console.error('Failed to send welcome message:', error);
  }

  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      data.timestamp = Date.now();

      console.log(`📡 Received: ${data.type} from ${data.userId || 'unknown'} in room ${data.roomId || 'unknown'}`);

      switch (data.type) {
        case 'join-room':
          if (!data.userId || !data.roomId) {
            console.error('❌ Invalid join-room message: missing userId or roomId');
            return;
          }
          currentUserId = data.userId;
          currentRoomId = data.roomId;
          addUserToRoom(data.roomId, data.userId, socket);
          break;

        case 'leave-room':
          if (currentRoomId && currentUserId) {
            removeUserFromRoom(currentRoomId, currentUserId);
            currentUserId = null;
            currentRoomId = null;
          }
          break;

        case 'offer':
        case 'answer':
        case 'ice-candidate':
          if (!data.targetUserId) {
            console.error(`❌ Missing targetUserId for ${data.type}`);
            return;
          }
          
          const targetSocket = userToSocket.get(data.targetUserId);
          if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
            try {
              targetSocket.send(JSON.stringify({
                type: 'p2p-signal',
                fromUserId: data.userId,
                toUserId: data.targetUserId,
                signal: {
                  type: data.type,
                  ...data.signal
                },
                timestamp: Date.now()
              }));
              console.log(`🔄 Routed ${data.type} from ${data.userId} to ${data.targetUserId}`);
            } catch (error) {
              console.error(`❌ Failed to route ${data.type}:`, error);
            }
          } else {
            console.warn(`⚠️ Target user ${data.targetUserId} not found or disconnected`);
            // Optionally send error back to sender
            try {
              socket.send(JSON.stringify({
                type: 'error',
                message: `Target user ${data.targetUserId} not available`,
                originalType: data.type,
                timestamp: Date.now()
              }));
            } catch (error) {
              console.error('Failed to send error message:', error);
            }
          }
          break;

        case 'ping':
          // Respond to ping with pong
          try {
            socket.send(JSON.stringify({
              type: 'pong',
              timestamp: Date.now()
            }));
          } catch (error) {
            console.error('Failed to send pong:', error);
          }
          break;

        default:
          console.warn(`❓ Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('❌ Error handling WebSocket message:', error);
      try {
        socket.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format',
          timestamp: Date.now()
        }));
      } catch (sendError) {
        console.error('Failed to send error response:', sendError);
      }
    }
  };

  socket.onclose = (event) => {
    console.log(`🔌 WebSocket closed for user ${currentUserId} (code: ${event.code}, reason: ${event.reason})`);
    if (currentRoomId && currentUserId) {
      removeUserFromRoom(currentRoomId, currentUserId);
    }
  };

  socket.onerror = (error) => {
    console.error(`❌ WebSocket error for user ${currentUserId}:`, error);
  };
}

serve((req) => {
  const url = new URL(req.url);
  
  // Handle WebSocket upgrade requests
  if (req.headers.get("upgrade") === "websocket") {
    console.log('🔌 WebSocket upgrade request received');
    
    try {
      const { socket, response } = Deno.upgradeWebSocket(req, {
        // Add subprotocol support if needed
        protocol: req.headers.get("sec-websocket-protocol")
      });
      
      handleWebSocket(socket);
      return response;
    } catch (error) {
      console.error('❌ Failed to upgrade WebSocket:', error);
      return new Response("Failed to upgrade WebSocket connection", { 
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization"
        }
      });
    }
  }

  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Upgrade, Connection, Sec-WebSocket-Key, Sec-WebSocket-Version, Sec-WebSocket-Protocol",
        "Access-Control-Max-Age": "86400"
      }
    });
  }

  // HTTP endpoints with CORS headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization"
  };

  if (url.pathname === "/") {
    return new Response(`
🔗 P2P Video Signaling Server

Status: Running ✅
Active Rooms: ${rooms.size}
Connected Users: ${userToSocket.size}

WebSocket Endpoint: wss://${req.headers.get('host')}

For P2P video calls only.
    `, {
      headers: { 
        "content-type": "text/plain",
        ...corsHeaders
      }
    });
  }

  if (url.pathname === "/health") {
    return new Response(JSON.stringify({
      status: "healthy",
      activeRooms: rooms.size,
      connectedUsers: userToSocket.size,
      timestamp: new Date().toISOString()
    }), {
      headers: { 
        "content-type": "application/json",
        ...corsHeaders
      }
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
      headers: { 
        "content-type": "application/json",
        ...corsHeaders
      }
    });
  }

  return new Response("Not Found", { 
    status: 404,
    headers: corsHeaders
  });
});

console.log("🚀 P2P Signaling Server starting...");
console.log("📡 WebSocket endpoint ready for P2P video calls");
console.log("🌐 CORS enabled for all origins");