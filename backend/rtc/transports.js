// backend/rtc/transports.js
const { getOrCreateRouter } = require("./routers");

/**
 * IMPORTANT:
 * In Docker bridge mode you MUST announce a reachable host.
 *
 * For your localhost dev:
 *   MEDIASOUP_ANNOUNCED_IP=localhost
 *
 * For VPS:
 *   MEDIASOUP_ANNOUNCED_IP=YOUR_PUBLIC_IP
 */
function getListenIps() {
  const announcedIp =
    process.env.MEDIASOUP_ANNOUNCED_IP ||
    process.env.MEDIASOUP_ANNOUNCED_ADDRESS;

  if (!announcedIp) {
    throw new Error("MEDIASOUP_ANNOUNCED_IP is not set");
  }

  return [
    {
      ip: "0.0.0.0",
      announcedIp,
    },
  ];
}

async function createWebRtcTransport({ roomId }) {
  const router = await getOrCreateRouter(String(roomId));

  const transport = await router.createWebRtcTransport({
    listenIps: getListenIps(),
    enableUdp: true,
    enableTcp: true,
    preferUdp: true,
    initialAvailableOutgoingBitrate: 600_000,
  });

  // Debug helper (safe to keep during dev)
  console.log("🧊 ICE candidates:", transport.iceCandidates);

  return { router, transport };
}

async function connectWebRtcTransport(transport, dtlsParameters) {
  await transport.connect({ dtlsParameters });
}

module.exports = {
  createWebRtcTransport,
  connectWebRtcTransport,
};