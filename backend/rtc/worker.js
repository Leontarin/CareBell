// backend/rtc/worker.js
const mediasoup = require("mediasoup");

let worker;

async function createWorker() {
  if (worker) return worker;

  worker = await mediasoup.createWorker({
    rtcMinPort: Number(process.env.RTC_PORT_MIN || 40000),
    rtcMaxPort: Number(process.env.RTC_PORT_MAX || 40200),
    logLevel: "warn",
    logTags: ["info", "ice", "dtls", "rtp", "rtcp"],
  });

  console.log("✅ Mediasoup worker created");

  worker.on("died", () => {
    console.error("❌ Mediasoup worker died, exiting...");
    process.exit(1);
  });

  return worker;
}

function getWorker() {
  if (!worker) throw new Error("Mediasoup worker not initialized");
  return worker;
}

module.exports = {
  createWorker,
  getWorker,
};