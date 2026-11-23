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
