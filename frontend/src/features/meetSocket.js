//frontend/src/features/meetSocket.js
import { io } from "socket.io-client";
import { API } from "../shared/config";

// feature-scoped singleton + refcount
let socket = null;
let users = 0;
let teardownTimer = null;

// React dev StrictMode mounts/unmounts twice.
// We delay teardown to the next tick; if we remount immediately, we cancel it.
const TEARDOWN_DELAY_MS = 0;

export function acquireMeetSocket() {
  users += 1;

  if (teardownTimer) {
    clearTimeout(teardownTimer);
    teardownTimer = null;
  }

  if (!socket) {
    socket = io(API, {
      withCredentials: true,
      transports: ["polling", "websocket"],
      timeout: 10000,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 500,
      reconnectionDelayMax: 3000,
    });
  } else {
    // IMPORTANT: if someone called socket.disconnect(), socket stays "manual".
    // We must explicitly reconnect.
    if (socket.disconnected) {
      try { socket.connect(); } catch {}
    }
  }

  return socket;
}

export function releaseMeetSocket(onTeardown) {
  users = Math.max(0, users - 1);
  if (users !== 0) return;

  teardownTimer = setTimeout(() => {
    teardownTimer = null;
    if (users !== 0) return;

    const s = socket;
    socket = null;

    try { onTeardown?.(s); } catch {}

    try { s?.removeAllListeners(); } catch {}
    try { s?.disconnect(); } catch {} // will show "forced close" — expected.
  }, TEARDOWN_DELAY_MS);
}