// backend/rtc/peers.js

// socketId -> peerState
const peers = new Map();

function ensurePeer(socket) {
  const sid = socket.id;
  let p = peers.get(sid);
  if (!p) {
    p = {
        socketId: sid,
        userId: String(socket.data.userId),
        roomId: null,
      
        // Strict: one send + one recv
        sendTransportId: null,
        recvTransportId: null,
      
        // Strict: max 1 audio + 1 video producer
        audioProducerId: null,
        videoProducerId: null,
      
        // Media UI state (for signaling)
        muted: false,
        cameraOff: true,
      
        transports: new Map(), // transportId -> transport
        producers: new Map(),  // producerId -> producer
        consumers: new Map(),  // consumerId -> consumer
      };
    peers.set(sid, p);
  }
  return p;
}

function setPeerRoom(socket, roomId) {
  const p = ensurePeer(socket);
  p.roomId = roomId ? String(roomId) : null;
  return p;
}

function getPeer(socket) {
  return peers.get(socket.id) || null;
}

async function closePeer(socket) {
  const p = peers.get(socket.id);
  if (!p) return;

  // Close mediasoup resources in safe order
  for (const consumer of p.consumers.values()) {
    try { consumer.close(); } catch {}
  }
  for (const producer of p.producers.values()) {
    try { producer.close(); } catch {}
  }
  for (const transport of p.transports.values()) {
    try { transport.close(); } catch {}
  }

  peers.delete(socket.id);
}

function listPeersInRoom(roomId) {
    const rid = roomId ? String(roomId) : null;
    if (!rid) return [];
    return Array.from(peers.values()).filter((p) => p.roomId === rid);
  }
  
  function findPeerByProducerId(producerId) {
    for (const p of peers.values()) {
      if (p.producers.has(String(producerId))) return p;
    }
    return null;
  }

module.exports = {
  ensurePeer,
  setPeerRoom,
  getPeer,
  closePeer,
  listPeersInRoom,
  findPeerByProducerId,
};