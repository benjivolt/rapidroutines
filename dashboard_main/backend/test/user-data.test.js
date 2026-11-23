const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, startDb, stopDb, clearDb, PASSWORD } = require('./helpers');
const UserData = require('../models/user-data');

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

const signUp = async (email) => {
  const res = await request(app).post('/api/auth/register').send({ name: 'Data User', email, password: PASSWORD });
  assert.equal(res.status, 201);
  return res.body;
};

const save = (token, body) => request(app).post('/api/user-data/save-data').set(bearer(token)).send(body);
const load = (token) => request(app).get('/api/user-data/get-data').set(bearer(token));

before(startDb);
after(stopDb);

describe('user data', () => {
  let a;
  let b;
  beforeEach(async () => {
    await clearDb();
    a = await signUp('a@example.com');
    b = await signUp('b@example.com');
  });

  it('requires authentication', async () => {
    assert.equal((await request(app).get('/api/user-data/get-data')).status, 401);
    assert.equal((await request(app).post('/api/user-data/save-data').send({})).status, 401);
  });

  it('returns empty defaults for a new user', async () => {
    const res = await load(a.token);
    assert.equal(res.status, 200);
    assert.deepEqual(res.body, {
      savedExercises: [],
      exerciseLog: [],
      chatHistory: [],
      rapidTreeProgress: {},
      trackerExercises: [],
    });
  });

  it('saves and reads back each allowed data type', async () => {
    const payloads = {
      savedExercises: [{ name: 'Push-up' }],
      exerciseLog: [{ exercise: 'Squat', reps: 10 }],
      chatHistory: [{ role: 'user', content: 'hi' }],
      rapidTreeProgress: { level: 3 },
      trackerExercises: [{ name: 'Lunge' }],
    };
    for (const [dataType, data] of Object.entries(payloads)) {
      const res = await save(a.token, { dataType, data });
      assert.equal(res.status, 200, dataType);
    }
    const res = await load(a.token);
    assert.deepEqual(res.body, payloads);
    assert.equal(await UserData.countDocuments(), 1);
  });

  it('keeps users isolated (no IDOR)', async () => {
    await save(a.token, { dataType: 'exerciseLog', data: [{ secret: 'A only' }] });
    const asB = await load(b.token);
    assert.equal(asB.status, 200);
    assert.deepEqual(asB.body.exerciseLog, []);

    const spoof = await save(b.token, {
      dataType: 'exerciseLog',
      data: [{ from: 'B' }],
      user: a.user.id,
      userId: a.user.id,
    });
    assert.equal(spoof.status, 200);
    const asA = await load(a.token);
    assert.deepEqual(asA.body.exerciseLog, [{ secret: 'A only' }]);
    assert.deepEqual((await load(b.token)).body.exerciseLog, [{ from: 'B' }]);
  });

  it('only accepts allowlisted data types', async () => {
    for (const dataType of [
      'user',
      'password',
      '_id',
      '__proto__',
      '$set',
      'createdAt',
      { $ne: null },
      ['savedExercises'],
    ]) {
      const res = await save(a.token, { dataType, data: [1] });
      assert.equal(res.status, 400, JSON.stringify(dataType));
    }
    assert.equal(await UserData.countDocuments(), 0);
  });

  it('requires data', async () => {
    const res = await save(a.token, { dataType: 'savedExercises' });
    assert.equal(res.status, 400);
  });

  it('returns 413 for data over 256KB', async () => {
    const res = await save(a.token, { dataType: 'chatHistory', data: ['x'.repeat(260 * 1024)] });
    assert.equal(res.status, 413);
    assert.equal(await UserData.countDocuments(), 0);
  });

  it('measures the cap in bytes, not characters', async () => {
    const res = await save(a.token, { dataType: 'chatHistory', data: ['é'.repeat(140 * 1024)] });
    assert.equal(res.status, 413);
  });

  it('accepts data just under the cap', async () => {
    const res = await save(a.token, { dataType: 'chatHistory', data: ['x'.repeat(200 * 1024)] });
    assert.equal(res.status, 200);
  });
  it('returns a generic 500 if measuring the payload throws', async () => {
    const realByteLength = Buffer.byteLength;
    Buffer.byteLength = function byteLength(value, ...rest) {
      if (value === '["__boom__"]') throw new Error('boom');
      return realByteLength.call(this, value, ...rest);
    };
    try {
      const res = await save(a.token, { dataType: 'chatHistory', data: ['__boom__'] });
      assert.equal(res.status, 500);
      assert.deepEqual(res.body, { message: 'Could not save your data.' });
    } finally {
      Buffer.byteLength = realByteLength;
    }
  });

  it('applies the cap to each data type separately', async () => {
    const big = ['x'.repeat(200 * 1024)];
    assert.equal((await save(a.token, { dataType: 'chatHistory', data: big })).status, 200);
    assert.equal((await save(a.token, { dataType: 'exerciseLog', data: big })).status, 200);
  });
});
