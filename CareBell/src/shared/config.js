// CareBell/src/shared/config.js

// --- API base (normalize: no trailing slash) ---
const RAW_API = import.meta.env.VITE_BACKEND_URL || "http://localhost:4443";
export const API = RAW_API.replace(/\/+$/, "");

// Keep your existing exports
export const P2P_SIGNALING_URL = "wss://carebellp2p.deno.dev";
export const NEWS_REGIONS = "1";

export const P2P_CONFIG = {
  MAX_PARTICIPANTS: 10,
  CONNECTION_TIMEOUT: 30000,
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 3000,

  VIDEO_CONSTRAINTS: {
    width: { ideal: 640, max: 1280 },
    height: { ideal: 480, max: 720 },
    frameRate: { ideal: 15, max: 30 },
  },

  AUDIO_CONSTRAINTS: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    sampleRate: 44100,
  },

  RTC_CONFIG: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:openrelay.metered.ca:80" },
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
  },
};

// --- Small helpers ---
const join = (base, path) => `${base}${path.startsWith("/") ? "" : "/"}${path}`;

/**
 * Auth-aware fetch. Automatically:
 * - sends cookies (credentials: 'include')
 * - JSON stringifies plain objects for body
 * - sets Content-Type when needed
 * - parses JSON only if response says it's JSON (handles 204 etc.)
 */
export async function fetchJsonAuth(urlOrPath, init = {}) {
  const url = urlOrPath.startsWith("http") ? urlOrPath : join(API, urlOrPath);

  const finalInit = { credentials: "include", ...init };
  const headers = new Headers(finalInit.headers || {});

  // If body is a plain object, JSON-encode it and set content-type
  if (
    finalInit.body &&
    typeof finalInit.body === "object" &&
    !(finalInit.body instanceof FormData) &&
    !(finalInit.body instanceof Blob)
  ) {
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    finalInit.body = JSON.stringify(finalInit.body);
  }
  finalInit.headers = headers;

  const res = await fetch(url, finalInit);

  if (!res.ok) {
    // Try to surface any error text to help debugging
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? ` — ${txt}` : ""}`);
  }

  // 204/empty bodies or non-JSON: return null or raw text
  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const txt = await res.text().catch(() => "");
    return txt || null;
  }
  return res.json();
}

// Optional convenience wrappers
export const api = {
  get: (path, init) => fetchJsonAuth(path, { method: "GET", ...init }),
  post: (path, body, init) => fetchJsonAuth(path, { method: "POST", body, ...init }),
  put: (path, body, init) => fetchJsonAuth(path, { method: "PUT", body, ...init }),
  del: (path, init) => fetchJsonAuth(path, { method: "DELETE", ...init }),
};
