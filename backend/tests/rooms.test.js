const request = require('supertest');
const jwt = require('jsonwebtoken');
const { io: ioClient } = require('socket.io-client');

const Room = require('../models/room');
const { connect, close, clear } = require('./setup');

let app;
let server;
let httpServer;
let baseURL;

const clients = new Set();

function cookieFor(uid, email = 'x@test.com') {
  const token = jwt.sign({ uid, email }, process.env.SESSION_JWT_SECRET, { expiresIn: '1h' });
  return `session=${token}`;
}

function connectClient({ userId, fullName }) {
  const s = ioClient(baseURL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    forceNew: true,
    reconnection: false,
    timeout: 8000,
    auth: { userId, fullName }, // test-mode auth
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

async function hardDisconnect(s) {
  if (!s) return;
  try { s.removeAllListeners(); } catch {}
  try { s.disconnect(); } catch {}
  try { s.close(); } catch {}
  try { s.io?.close(); } catch {}
  try { s.io?.engine?.close(); } catch {}
  await new Promise(r => setTimeout(r, 50));
  clients.delete(s);
}

beforeAll(async () => {
  await connect();
  ({ app, server } = require('../api/app'));
  await new Promise((resolve) => { httpServer = server.listen(0, resolve); });
  const port = httpServer.address().port;
  baseURL = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  for (const s of Array.from(clients)) await hardDisconnect(s);
  await clear();
});

afterAll(async () => {
  for (const s of Array.from(clients)) await hardDisconnect(s);

  // ✅ important: close Socket.IO so http server can close cleanly
  const io = app.get('io');
  if (io) await new Promise((r) => io.close(r));

  if (httpServer) await new Promise((resolve) => httpServer.close(resolve));
  await close();
});

describe('Rooms REST (control-plane) + Socket membership', () => {
  test('Create temp room auto-joins creator when socket is connected', async () => {
    const s = connectClient({ userId: 'u1', fullName: 'User One' });
    s.connect();
    await waitFor(s, 'rtc:ready');

    const res = await request(app)
      .post('/rooms/create')
      .set('Cookie', cookieFor('u1'))
      .send({ name: 'RoomA', maxParticipants: 5 });

    expect(res.statusCode).toBe(200);
    expect(res.body.room?.name).toBe('RoomA');
    expect(res.body.roster?.participants?.some(p => p.userId === 'u1')).toBe(true);

    const room = await Room.findOne({ name: 'RoomA' }).lean();
    expect(room).not.toBeNull();
    expect(room.participants.some(p => p.userId === 'u1')).toBe(true);

    await hardDisconnect(s);
  });

  test('Join route requires active socket', async () => {
    const room = await Room.create({ name: 'RoomB', type: 'temporary', maxParticipants: 5 });

    const res = await request(app)
      .post(`/rooms/join/${room._id}`)
      .set('Cookie', cookieFor('u2'))
      .send();

    expect(res.statusCode).toBe(409);
  });

  test('Join via REST triggers socket join and enforces one-room-per-user', async () => {
    const s = connectClient({ userId: 'u3', fullName: 'User Three' });
    s.connect();
    await waitFor(s, 'rtc:ready');

    const r1 = await Room.create({ name: 'RoomC1', type: 'temporary', maxParticipants: 5 });
    const r2 = await Room.create({ name: 'RoomC2', type: 'temporary', maxParticipants: 5 });

    const j1 = await request(app)
      .post(`/rooms/join/${r1._id}`)
      .set('Cookie', cookieFor('u3'))
      .send();
    expect(j1.statusCode).toBe(200);

    const j2 = await request(app)
      .post(`/rooms/join/${r2._id}`)
      .set('Cookie', cookieFor('u3'))
      .send();
    expect(j2.statusCode).toBe(200);

    const room1 = await Room.findById(r1._id).lean();
    const room2 = await Room.findById(r2._id).lean();

    expect(room1).toBeNull(); // temp room auto-deleted when emptied
    expect(room2.participants.some(p => p.userId === 'u3')).toBe(true);

    await hardDisconnect(s);
  });

  test('Admin delete kicks sockets in the room', async () => {
    const room = await Room.create({ name: 'RoomD', type: 'temporary', maxParticipants: 5 });

    const s1 = connectClient({ userId: 'u4', fullName: 'User Four' });
    const s2 = connectClient({ userId: 'u5', fullName: 'User Five' });

    s1.connect(); s2.connect();
    await waitFor(s1, 'rtc:ready');
    await waitFor(s2, 'rtc:ready');

    s1.emit('rtc:join-room', { roomId: String(room._id) });
    s2.emit('rtc:join-room', { roomId: String(room._id) });
    await waitFor(s1, 'rtc:roster');
    await waitFor(s2, 'rtc:roster');

    const deletedP1 = waitFor(s1, 'rtc:room-deleted', 8000);
    const deletedP2 = waitFor(s2, 'rtc:room-deleted', 8000);

    const delRes = await request(app).delete(`/rooms/${room._id}`); // isAdmin mocked
    expect(delRes.statusCode).toBe(200);

    await deletedP1;
    await deletedP2;

    const gone = await Room.findById(room._id);
    expect(gone).toBeNull();

    await hardDisconnect(s1);
    await hardDisconnect(s2);
  });
});
