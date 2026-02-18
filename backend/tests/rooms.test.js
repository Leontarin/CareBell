//backend/tests/rooms.test.js
const request = require('supertest');
const { app } = require('../api/app');
const Room = require('../models/room');
const { connect, close, clear } = require('./setup');

beforeAll(async () => {
  await connect();
});

afterEach(async () => {
  await clear();
});

afterAll(async () => {
  await close();
});

describe('Rooms API', () => {

  test('Create temporary room', async () => {
    const res = await request(app)
      .post('/rooms/create')
      .send({
        name: 'TestRoom',
        type: 'temporary',
        maxParticipants: 5
      });

    expect(res.statusCode).toBe(200);

    const room = await Room.findOne({ name: 'TestRoom' });
    expect(room).not.toBeNull();
    expect(room.type).toBe('temporary');
  });

  test('User joins room', async () => {
    const createRes = await request(app)
      .post('/rooms/create')
      .send({ name: 'JoinRoom', maxParticipants: 5 });

    const roomId = createRes.body._id;

    const joinRes = await request(app)
      .post(`/rooms/join/${roomId}`);

    expect(joinRes.statusCode).toBe(200);

    const room = await Room.findById(roomId);
    expect(room).not.toBeNull();
    expect(room.participants.length).toBe(1);
  });

  test('User cannot exceed maxParticipants', async () => {
    const createRes = await request(app)
        .post('/rooms/create')
        .send({ name: 'FullRoom', maxParticipants: 1 });

    const roomId = createRes.body._id;

    // First user fills the room
    const j1 = await request(app)
        .post(`/rooms/join/${roomId}`)
        .set('x-test-user', 'user1')
        .set('x-test-name', 'User 1');

    expect(j1.statusCode).toBe(200);

    // Second user should be rejected
    const j2 = await request(app)
        .post(`/rooms/join/${roomId}`)
        .set('x-test-user', 'user2')
        .set('x-test-name', 'User 2');

    expect(j2.statusCode).toBe(400);
    });

  test('User auto-deletes previous temporary room when switching', async () => {
    const r1 = await request(app)
        .post('/rooms/create')
        .send({ name: 'Room1', type: 'temporary' });

    const r2 = await request(app)
        .post('/rooms/create')
        .send({ name: 'Room2', type: 'temporary' });

    const j1 = await request(app)
        .post(`/rooms/join/${r1.body._id}`)
        .set('x-test-user', 'user1')
        .set('x-test-name', 'User 1');

    expect(j1.statusCode).toBe(200);

    const j2 = await request(app)
        .post(`/rooms/join/${r2.body._id}`)
        .set('x-test-user', 'user1')
        .set('x-test-name', 'User 1');

    expect(j2.statusCode).toBe(200);

    const room1 = await Room.findById(r1.body._id);
    const room2 = await Room.findById(r2.body._id);

    expect(room1).toBeNull();          // temp + empty => deleted
    expect(room2).not.toBeNull();
    expect(room2.participants.length).toBe(1);
    });

  test('Temporary room auto-deletes when empty', async () => {
    const createRes = await request(app)
      .post('/rooms/create')
      .send({ name: 'TempRoom', type: 'temporary' });

    const roomId = createRes.body._id;

    await request(app).post(`/rooms/join/${roomId}`);
    await request(app).post('/rooms/leave');

    const room = await Room.findById(roomId);
    expect(room).toBeNull();
  });

});