//backend/tests/presence.test.js
const { io: ioClient } = require('socket.io-client');
const Room = require('../models/room');
const { connect, close, clear } = require('./setup');

let app;
let server;
let httpServer;
let baseURL;

const clients = new Set();

function connectClient({ userId, fullName }) {
  const s = ioClient(baseURL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    forceNew: true,
    reconnection: false,
    timeout: 8000,
    auth: { userId, fullName },
    path: '/socket.io',
  });
  clients.add(s);
  return s;
}

function waitFor(socket, event, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), ms);
    socket.once(event, (data) => { clearTimeout(t); resolve(data); });
  });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function hardDisconnect(s) {
  if (!s) return;
  try { s.removeAllListeners(); } catch {}
  try { s.disconnect(); } catch {}
  try { s.close(); } catch {}
  try { s.io?.close(); } catch {}
  try { s.io?.engine?.close(); } catch {}
  await delay(50);
  clients.delete(s);
}

beforeAll(async () => {
  await connect();
  ({ app, server } = require('../api/app'));

  await new Promise((resolve) => {
    httpServer = server.listen(0, resolve);
  });

  const port = httpServer.address().port;
  baseURL = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  for (const s of Array.from(clients)) await hardDisconnect(s);
  await clear();
});

afterAll(async () => {
  for (const s of Array.from(clients)) await hardDisconnect(s);

  const io = app.get('io');
  if (io) await new Promise((r) => io.close(r));

  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  await close();
});

describe('Socket presence cleanup', () => {
  test('Disconnect removes membership and deletes empty temp room after grace', async () => {
    const room = await Room.create({ name: 'TempCleanup', type: 'temporary', maxParticipants: 5 });

    const s = connectClient({ userId: 'u10', fullName: 'User Ten' });
    s.connect();
    await waitFor(s, 'rtc:ready');

    s.emit('rtc:join-room', { roomId: String(room._id) });
    await waitFor(s, 'rtc:roster');

    // simulate connection drop
    await hardDisconnect(s);

    // grace default is 4s; wait a bit more
    await delay(4500);

    const gone = await Room.findById(room._id);
    expect(gone).toBeNull();
  });

  test('Reconnect without re-join does not keep membership (no autojoin)', async () => {
    const room = await Room.create({ name: 'NoAutoJoin', type: 'temporary', maxParticipants: 5 });

    const s1 = connectClient({ userId: 'u11', fullName: 'User Eleven' });
    s1.connect();
    await waitFor(s1, 'rtc:ready');

    s1.emit('rtc:join-room', { roomId: String(room._id) });
    await waitFor(s1, 'rtc:roster');

    await hardDisconnect(s1);

    // reconnect quickly but do NOT re-join
    const s2 = connectClient({ userId: 'u11', fullName: 'User Eleven' });
    s2.connect();
    await waitFor(s2, 'rtc:ready');

    await delay(4500);

    const gone = await Room.findById(room._id);
    expect(gone).toBeNull();

    await hardDisconnect(s2);
  });
});
