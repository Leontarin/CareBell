// backend/rtc/peers.js

const peers = new Map(); // socketId -> peerState

function ensurePeer(socket) {
  const sid = socket.id;
  let p = peers.get(sid);

  if (!p) {
    p = {
      socketId: sid,
      userId: String(socket.data.userId),
      roomId: null,

      sendTransportId: null,
      recvTransportId: null,

      audioProducerId: null,
      videoProducerId: null,

      muted: false,
      cameraOff: true,

      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
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
  return Array.from(peers.values()).filter(p => p.roomId === rid);
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