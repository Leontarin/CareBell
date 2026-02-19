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
    autoConnect: false,
    transports: ['websocket', 'polling'],
    forceNew: true,
    reconnection: false,
    timeout: 8000,
    auth: { userId, fullName },
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
    httpServer = server.listen(0, resolve);
  });
  const port = httpServer.address().port;
  baseURL = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
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

describe('Socket.IO Presence - Architecture Invariants', () => {

  test('Non-member cannot join presence room', async () => {
    const createRes = await request(app)
      .post('/rooms/create')
      .send({ name: 'SecureRoom', type: 'temporary' });

    const roomId = createRes.body._id;

    const s = connectClient({ userId: 'attacker', fullName: 'Bad Actor' });
    const readyP = waitForOrFail(s, 'rtc:ready');
    s.connect();
    await readyP;

    s.emit('rtc:join-room', { roomId });

    await expect(waitForOrFail(s, 'rtc:roster'))
      .rejects
      .toThrow();
  });

  test('Capacity cannot be bypassed via socket', async () => {
    const createRes = await request(app)
      .post('/rooms/create')
      .send({ name: 'CapRoom', maxParticipants: 1 });

    const roomId = createRes.body._id;

    await request(app)
      .post(`/rooms/join/${roomId}`)
      .set('x-test-user', 'user1')
      .set('x-test-name', 'User 1');

    const s2 = connectClient({ userId: 'user2', fullName: 'User 2' });
    const readyP = waitForOrFail(s2, 'rtc:ready');
    s2.connect();
    await readyP;

    s2.emit('rtc:join-room', { roomId });

    await expect(waitForOrFail(s2, 'rtc:roster'))
      .rejects
      .toThrow();
  });

  test('Permanent room does NOT auto-delete when empty', async () => {
    const createRes = await request(app)
      .post('/rooms/create-permanent')
      .send({ name: 'PermRoom', maxParticipants: 5 });

    const roomId = createRes.body._id;

    await request(app)
      .post(`/rooms/join/${roomId}`)
      .set('x-test-user', 'user1')
      .set('x-test-name', 'User 1');

    const s = connectClient({ userId: 'user1', fullName: 'User 1' });
    const readyP = waitForOrFail(s, 'rtc:ready');
    s.connect();
    await readyP;

    s.emit('rtc:join-room', { roomId });
    await waitForOrFail(s, 'rtc:roster');

    const discP = waitFor(s, 'disconnect');
    s.disconnect();
    await discP;

    await delay(250);

    const room = await Room.findById(roomId);
    expect(room).not.toBeNull();
  });

  test('Duplicate rtc:join-room does not duplicate roster state', async () => {
    const createRes = await request(app)
      .post('/rooms/create')
      .send({ name: 'DupRoom', type: 'temporary' });

    const roomId = createRes.body._id;

    await request(app)
      .post(`/rooms/join/${roomId}`)
      .set('x-test-user', 'user1')
      .set('x-test-name', 'User 1');

    const s = connectClient({ userId: 'user1', fullName: 'User 1' });
    const readyP = waitForOrFail(s, 'rtc:ready');
    s.connect();
    await readyP;

    s.emit('rtc:join-room', { roomId });
    const roster1 = await waitForOrFail(s, 'rtc:roster');

    s.emit('rtc:join-room', { roomId });
    const roster2 = await waitForOrFail(s, 'rtc:roster');

    expect(roster1.participantsCount).toBe(1);
    expect(roster2.participantsCount).toBe(1);
  });

});
