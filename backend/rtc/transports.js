// backend/rtc/transports.js
const { getOrCreateRouter } = require("./routers");

function normalizeAnnouncedAddress(raw) {
  if (!raw) return null;

  const v = String(raw).trim();
  if (!v) return null;

  // ICE candidates with 0.0.0.0 / :: are not reachable from browsers.
  if (v === "0.0.0.0" || v === "::") return null;

  // Localhost is valid in many setups, but 127.0.0.1 is the most predictable
  // value for host-browser + dockerized backend development.
  if (v === "localhost" || v === "::1") return "127.0.0.1";

  return v;
}

/**
 * IMPORTANT:
 * In Docker bridge mode you MUST announce a host that the browser can reach.
 * Priority:
 *   1. MEDIASOUP_ANNOUNCED_IP / MEDIASOUP_ANNOUNCED_ADDRESS
 *   2. value inferred from current socket request host
 */
function getAnnouncedAddress(requestAnnouncedAddress) {
  const fromEnv =
    process.env.MEDIASOUP_ANNOUNCED_IP ||
    process.env.MEDIASOUP_ANNOUNCED_ADDRESS;

  const announcedAddress =
    normalizeAnnouncedAddress(fromEnv) ||
    normalizeAnnouncedAddress(requestAnnouncedAddress);

  if (!announcedAddress) {
    throw new Error(
      "Unable to determine mediasoup announced address. Set MEDIASOUP_ANNOUNCED_IP."
    );
  }

  return announcedAddress;
}

async function createWebRtcTransport({ roomId, announcedAddress: requestAnnouncedAddress }) {
  const router = await getOrCreateRouter(String(roomId));
  const announcedAddress = getAnnouncedAddress(requestAnnouncedAddress);

  const transport = await router.createWebRtcTransport({
    // listenInfos is the recommended API in current mediasoup versions.
    listenInfos: [
      {
        protocol: "udp",
        ip: "0.0.0.0",
        announcedAddress,
      },
      {
        protocol: "tcp",
        ip: "0.0.0.0",
        announcedAddress,
      },
    ],
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
