// backend/tests/presence.test.js
jest.setTimeout(30000);

const request = require('supertest');
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
    autoConnect: false,               // we manually connect
    transports: ['websocket', 'polling'],
    forceNew: true,
    reconnection: false,
    timeout: 8000,
    auth: { userId, fullName },       // ✅ server reads this in test mode
    path: '/socket.io',
  });

  clients.add(s);
  s.on('disconnect', () => clients.delete(s));
  return s;
}

function waitForOrFail(socket, event, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), ms);

    const cleanup = () => {
      clearTimeout(t);
      socket.off(event, onEvent);
      socket.off('connect_error', onConnectError);
      socket.off('rtc:error', onRtcError);
      socket.off('disconnect', onDisconnect);
    };

    const onEvent = (data) => { cleanup(); resolve(data); };
    const onConnectError = (err) => { cleanup(); reject(err instanceof Error ? err : new Error(String(err))); };
    const onRtcError = (payload) => { cleanup(); reject(new Error(`rtc:error: ${JSON.stringify(payload)}`)); };
    const onDisconnect = (reason) => { cleanup(); reject(new Error(`Disconnected before "${event}". reason="${reason}"`)); };

    socket.once(event, onEvent);
    socket.once('connect_error', onConnectError);
    socket.once('rtc:error', onRtcError);
    socket.once('disconnect', onDisconnect);
  });
}

function waitFor(socket, event, ms = 8000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for "${event}"`)), ms);
    socket.once(event, (data) => {
      clearTimeout(t);
      resolve(data);
    });
  });
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

beforeAll(async () => {
  await connect();

  ({ app, server } = require('../api/app'));

  await new Promise((resolve) => {
    httpServer = server.listen(0, resolve); // ephemeral port
  });

  const port = httpServer.address().port;
  baseURL = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  // prevent leaks that hang Jest
  for (const s of Array.from(clients)) {
    try { s.disconnect(); } catch {}
    clients.delete(s);
  }
  await clear();
});

afterAll(async () => {
  for (const s of Array.from(clients)) {
    try { s.disconnect(); } catch {}
  }
  clients.clear();

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(resolve));
  }
  await close();
});

describe('Socket.IO Presence', () => {
  test('One active socket per user: new connection kicks old', async () => {
    const s1 = connectClient({ userId: 'u1', fullName: 'User One' });
    const ready1P = waitForOrFail(s1, 'rtc:ready', 8000);
    s1.connect();
    await ready1P;

    // observe kick/disconnect
    const kickedP = waitForOrFail(s1, 'rtc:kicked', 8000);
    const disconnectedP = waitFor(s1, 'disconnect', 8000);

    const s2 = connectClient({ userId: 'u1', fullName: 'User One' });
    const ready2P = waitForOrFail(s2, 'rtc:ready', 8000);
    s2.connect();
    await ready2P;

    await kickedP;
    await disconnectedP;

    expect(s2.connected).toBe(true);

    const disc2P = waitFor(s2, 'disconnect', 8000);
    s2.disconnect();
    await disc2P;
  });

  test('Disconnect cleanup removes user from DB room and deletes empty active temporary room', async () => {
    // Create room
    const createRes = await request(app)
      .post('/rooms/create')
      .send({ name: 'PresenceRoom', type: 'temporary', maxParticipants: 5 });

    expect(createRes.statusCode).toBe(200);
    const roomId = createRes.body._id;

    // Join room via REST (authoritative)
    const joinRes = await request(app)
      .post(`/rooms/join/${roomId}`)
      .set('x-test-user', 'u2')
      .set('x-test-name', 'User Two');

    expect(joinRes.statusCode).toBe(200);

    let room = await Room.findById(roomId);
    expect(room).not.toBeNull();
    expect(room.participants.some(p => p.userId === 'u2')).toBe(true);

    // Connect socket + presence join
    const s = connectClient({ userId: 'u2', fullName: 'User Two' });
    const readyP = waitForOrFail(s, 'rtc:ready', 8000);
    s.connect();
    await readyP;

    s.emit('rtc:join-room', { roomId });
    const roster = await waitForOrFail(s, 'rtc:roster', 8000);
    expect(roster.roomId).toBe(String(roomId));

    // Disconnect -> should cleanup DB and delete empty temp room
    const discP = waitFor(s, 'disconnect', 8000);
    s.disconnect();
    await discP;

    // give server disconnect cleanup a moment
    await delay(250);

    room = await Room.findById(roomId);
    expect(room).toBeNull();
  });
});
