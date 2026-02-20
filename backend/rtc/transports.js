// backend/rtc/transports.js
const { getOrCreateRouter } = require("./routers");

function getListenIps() {
  const announcedIp = process.env.MEDIASOUP_ANNOUNCED_IP;

  // In Docker bridge mode, you typically set MEDIASOUP_ANNOUNCED_IP in prod.
  // In dev (localhost), leaving it undefined is fine.
  return [{ ip: "0.0.0.0", announcedIp }];
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

  // Optional: cap max incoming bitrate (client -> server), useful later for mobile safety
  // You can adjust per transport when we start simulcast.
  // await transport.setMaxIncomingBitrate(2_000_000);

  return { router, transport };
}

async function connectWebRtcTransport(transport, dtlsParameters) {
  await transport.connect({ dtlsParameters });
}

module.exports = {
  createWebRtcTransport,
  connectWebRtcTransport,
};