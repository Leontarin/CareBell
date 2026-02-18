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

});
