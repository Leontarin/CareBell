// CareBell/src/shared/config.js

// --- build an API base that works on any server ---
// 1) If VITE_BACKEND_URL is provided and NOT localhost -> use it
// 2) Otherwise, fall back to same host where the SPA was loaded, port 5174
function pickApiBase() {
  const envUrl = (import.meta.env.VITE_BACKEND_URL || "").trim();
  const isLocalhost =
    /^https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?$/i.test(envUrl);
  if (envUrl && !isLocalhost) return envUrl.replace(/\/+$/, "");

  const host = window.location.hostname;            // e.g. IP or domain
  const proto = window.location.protocol;           // http: or https:
  const port = 5174;                                // backend port exposed by compose
  return `${proto}//${host}:${port}`;
}

export const API = pickApiBase();

// Keep your existing exports (edit signaling if you want same-host too)
const envSignalingUrl = (import.meta.env.VITE_SIGNALING_URL || "").trim();

const pickDefaultSignalingUrl = () => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.hostname;
  const port = 5175;
  return `${protocol}//${host}:${port}`;
};

const normalizeToHttp = (url) =>
  url.replace(/^ws(s)?:/i, (_, secure) => (secure ? "https:" : "http:"));

export const NEWS_REGIONS = "1";

// --- helpers ---
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

  if (
    finalInit.body &&
    typeof finalInit.body === "object" &&
    !(finalInit.body instanceof FormData) &&
    !(finalInit.body instanceof Blob)
  ) {
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
    finalInit.body = JSON.stringify(finalInit.body);
  }
  finalInit.headers = headers;

  const res = await fetch(url, finalInit);

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} ${res.statusText}${txt ? ` — ${txt}` : ""}`);
  }

  const ct = res.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const txt = await res.text().catch(() => "");
    return txt || null;
  }
  return res.json();
}

export const api = {
  get: (path, init) => fetchJsonAuth(path, { method: "GET", ...init }),
  post: (path, body, init) => fetchJsonAuth(path, { method: "POST", body, ...init }),
  put: (path, body, init) => fetchJsonAuth(path, { method: "PUT", body, ...init }),
  patch: (path, body, init) => fetchJsonAuth(path, { method: "PATCH", body, ...init }),
  del: (path, init) => fetchJsonAuth(path, { method: "DELETE", ...init }),
};

