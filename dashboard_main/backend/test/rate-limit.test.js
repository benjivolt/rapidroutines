const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, startDb, stopDb } = require('./helpers');

before(async () => {
  await startDb();
  process.env.RATE_LIMIT_IN_TESTS = 'true';
});
after(async () => {
  delete process.env.RATE_LIMIT_IN_TESTS;
  await stopDb();
});

describe('login rate limit', () => {
  it('returns 429 after 10 attempts', async () => {
    const attempt = () =>
      request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'Wr0ng!Password' });
    for (let i = 0; i < 10; i += 1) {
      assert.equal((await attempt()).status, 400);
    }
    const blocked = await attempt();
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.message, /Too many sign-in attempts/);
    assert.ok(blocked.headers.ratelimit || blocked.headers['ratelimit-policy']);
  });
});

describe('site-wide request ceiling', () => {
  it('also bounds repeated requests to public endpoints', async () => {
    const headers = { 'X-Forwarded-For': '203.0.113.222' };
    for (let i = 0; i < 3000; i += 1) {
      assert.equal((await request(app).get('/api').set(headers)).status, 200);
    }
    const blocked = await request(app).get('/api').set(headers);
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.message, /Too many requests/);
  });
});

const jwt = require('jsonwebtoken');
const User = require('../models/user');
const { PASSWORD } = require('./helpers');

const from = (ip) => ({ 'X-Forwarded-For': ip });
const tokenFor = (user) => jwt.sign({ id: user.id, tv: 0 }, process.env.JWT_SECRET, { algorithm: 'HS256' });

describe('account limiters are separate buckets', () => {
  it('limits register per IP without affecting reset-password or forgot-password', async () => {
    const ip = '203.0.113.10';
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await request(app).post('/api/auth/register').set(from(ip)).send({})).status, 400);
    }
    assert.equal((await request(app).post('/api/auth/register').set(from(ip)).send({})).status, 429);
    const reset = await request(app).post('/api/auth/reset-password').set(from(ip)).send({ token: 'x', password: 'x' });
    assert.equal(reset.status, 400);
    const forgot = await request(app).post('/api/auth/forgot-password').set(from(ip)).send({ email: 'a@example.com' });
    assert.equal(forgot.status, 200);
  });

  it('limits forgot-password per email across IPs', async () => {
    const send = (ip, email) => request(app).post('/api/auth/forgot-password').set(from(ip)).send({ email });
    for (let i = 0; i < 3; i += 1) {
      assert.equal((await send(`198.51.100.${i + 1}`, 'Target@Example.com')).status, 200);
    }
    const blocked = await send('198.51.100.50', 'target@example.com');
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.message, /this email/);
    assert.equal((await send('198.51.100.50', 'other@example.com')).status, 200);
  });

  it('limits forgot-password per IP across emails', async () => {
    const ip = '192.0.2.77';
    for (let i = 0; i < 10; i += 1) {
      const res = await request(app).post('/api/auth/forgot-password').set(from(ip)).send({ email: `u${i}@example.com` });
      assert.equal(res.status, 200);
    }
    const blocked = await request(app).post('/api/auth/forgot-password').set(from(ip)).send({ email: 'new@example.com' });
    assert.equal(blocked.status, 429);
  });
});

describe('per-user password check limiter', () => {
  it('blocks repeated password checks per user on update-profile and delete-account', async () => {
    const victim = await User.create({ name: 'Victim', email: 'victim@example.com', password: PASSWORD });
    const other = await User.create({ name: 'Other', email: 'other-user@example.com', password: PASSWORD });
    const token = tokenFor(victim);
    const changeEmail = (ip, currentPassword) =>
      request(app)
        .put('/api/auth/update-profile')
        .set(from(ip))
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Victim', email: 'victim2@example.com', currentPassword });

    for (let i = 0; i < 5; i += 1) {
      assert.equal((await changeEmail(`203.0.113.${100 + i}`, 'Wr0ng!Password')).status, 403);
    }
    const blocked = await changeEmail('203.0.113.200', PASSWORD);
    assert.equal(blocked.status, 429);
    assert.match(blocked.body.message, /password attempts/);

    const del = await request(app)
      .delete('/api/auth/delete-account')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: PASSWORD });
    assert.equal(del.status, 429);
    assert.ok(await User.exists({ _id: victim.id }));

    const rename = await request(app)
      .put('/api/auth/update-profile')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Renamed' });
    assert.equal(rename.status, 200);

    const otherDelete = await request(app)
      .delete('/api/auth/delete-account')
      .set('Authorization', `Bearer ${tokenFor(other)}`)
      .send({ currentPassword: 'Wr0ng!Password' });
    assert.equal(otherDelete.status, 403);
  });

  it('rate limits update-profile generally', async () => {
    const user = await User.create({ name: 'Busy', email: 'busy@example.com', password: PASSWORD });
    const token = tokenFor(user);
    const rename = () =>
      request(app).put('/api/auth/update-profile').set('Authorization', `Bearer ${token}`).send({ name: 'Busy' });
    for (let i = 0; i < 30; i += 1) {
      assert.equal((await rename()).status, 200);
    }
    assert.equal((await rename()).status, 429);
  });
});
