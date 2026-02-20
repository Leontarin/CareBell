// backend/rtc/routers.js
const { getWorker } = require("./worker");

const routers = new Map(); // roomId -> router

const mediaCodecs = [
  {
    kind: "audio",
    mimeType: "audio/opus",
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: "video",
    mimeType: "video/VP8",
    clockRate: 90000,
    parameters: {},
  },
];

async function getOrCreateRouter(roomId) {
  if (routers.has(roomId)) {
    return routers.get(roomId);
  }

  const worker = getWorker();
  const router = await worker.createRouter({ mediaCodecs });

  routers.set(roomId, router);

  console.log(`📡 Router created for room ${roomId}`);

  return router;
}

function getRouter(roomId) {
  return routers.get(roomId);
}

async function closeRouter(roomId) {
  const router = routers.get(roomId);
  if (!router) return;

  await router.close();
  routers.delete(roomId);

  console.log(`🧹 Router closed for room ${roomId}`);
}

module.exports = {
  getOrCreateRouter,
  getRouter,
  closeRouter,
};