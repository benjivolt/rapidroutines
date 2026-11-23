const { describe, it, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, sentEmails, startDb, stopDb, clearDb, PASSWORD } = require('./helpers');
const User = require('../models/user');
const UserData = require('../models/user-data');

const register = (overrides = {}) =>
  request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email: 'user@example.com', password: PASSWORD, ...overrides });

const login = (email = 'user@example.com', password = PASSWORD) =>
  request(app).post('/api/auth/login').send({ email, password });

const bearer = (token) => ({ Authorization: `Bearer ${token}` });

const RESET_URL_RE = /href="(https?:\/\/[^"]+\/dashboard\/reset-password\/([0-9a-f]{64}))"/;

before(startDb);
after(stopDb);
beforeEach(clearDb);

describe('register', () => {
  it('creates an account and returns a token without the password hash', async () => {
    const res = await register();
    assert.equal(res.status, 201);
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, 'user@example.com');
    assert.equal(res.body.user.password, undefined);
    const stored = await User.findOne({ email: 'user@example.com' });
    assert.notEqual(stored.password, PASSWORD);
    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, 'user@example.com');
  });

  it('puts the escaped name into the welcome email literally', async () => {
    const res = await register({ name: "Jo $& $' $` O'Neil" });
    assert.equal(res.status, 201);
    const { html } = sentEmails[0];
    assert.match(html, /Hello Jo \$&amp; \$&#39; \$` O&#39;Neil,/);
    assert.doesNotMatch(html, /\{name\}/);
  });

  it('rejects padded emails and lowercases the stored email', async () => {
    const res = await register({ email: '  USER@Example.COM ' });
    assert.equal(res.status, 400);
    const ok = await register({ email: 'USER@Example.COM' });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.user.email, 'user@example.com');
  });

  for (const [label, body, message] of [
    ['missing name', { name: '' }, /name/i],
    ['name over 50 chars', { name: 'a'.repeat(51) }, /name/i],
    ['whitespace-only name', { name: '   ' }, /name/i],
    ['name with <script>', { name: '<script>alert(1)</script>' }, /name/i],
    ['name with a URL', { name: 'visit https://spam.example' }, /name/i],
    ['invalid email', { email: 'not-an-email' }, /email/i],
    ['weak password', { password: 'password' }, /Password must be/],
    ['password over 128 chars', { password: `Aa1!${'a'.repeat(130)}` }, /Password must be/],
    ['non-string password', { password: ['Str0ng!Passw0rd'] }, /Password must be/],
  ]) {
    it(`rejects ${label}`, async () => {
      const res = await register(body);
      assert.equal(res.status, 400);
      assert.match(res.body.message, message);
      assert.equal(await User.countDocuments(), 0);
    });
  }

  it('returns a generic message for a duplicate email', async () => {
    await register();
    const res = await register({ email: 'USER@example.com', name: 'Other' });
    assert.equal(res.status, 400);
    assert.equal(res.body.message, 'Could not create an account with that email.');
    assert.equal(await User.countDocuments(), 1);
  });
});

describe('login and sessions', () => {
  beforeEach(async () => {
    await register();
  });

  it('logs in and the token works on /api/auth/user', async () => {
    const res = await login('USER@example.com');
    assert.equal(res.status, 200);
    const me = await request(app).get('/api/auth/user').set(bearer(res.body.token));
    assert.equal(me.status, 200);
    assert.equal(me.body.user.email, 'user@example.com');
    assert.equal(me.body.user.password, undefined);
    assert.equal(me.body.user.resetPasswordToken, undefined);
  });

  it('returns identical responses for a wrong password and an unknown email', async () => {
    const wrong = await login('user@example.com', 'Wr0ng!Password');
    const unknown = await login('nobody@example.com', 'Wr0ng!Password');
    assert.equal(wrong.status, 400);
    assert.equal(unknown.status, wrong.status);
    assert.deepEqual(unknown.body, wrong.body);
  });

  it('rejects requests without a valid bearer token', async () => {
    assert.equal((await request(app).get('/api/auth/user')).status, 401);
    assert.equal((await request(app).get('/api/auth/user').set(bearer('garbage'))).status, 401);
    assert.equal((await request(app).get('/api/auth/user').set('Authorization', 'Token abc')).status, 401);
  });

  it('rejects a token signed with another secret or algorithm', async () => {
    const jwt = require('jsonwebtoken');
    const user = await User.findOne();
    const forged = jwt.sign({ id: user.id, tv: 0 }, 'not-the-secret');
    assert.equal((await request(app).get('/api/auth/user').set(bearer(forged))).status, 401);
    const none = jwt.sign({ id: user.id, tv: 0 }, null, { algorithm: 'none' });
    assert.equal((await request(app).get('/api/auth/user').set(bearer(none))).status, 401);
  });

  it('logout revokes the old token', async () => {
    const { token } = (await login()).body;
    const out = await request(app).post('/api/auth/logout').set(bearer(token));
    assert.equal(out.status, 200);
    const me = await request(app).get('/api/auth/user').set(bearer(token));
    assert.equal(me.status, 401);
    const fresh = (await login()).body.token;
    assert.equal((await request(app).get('/api/auth/user').set(bearer(fresh))).status, 200);
  });

  it('rejects NoSQL operator payloads on login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: { $ne: null }, password: { $ne: null } });
    assert.equal(res.status, 400);
    assert.equal(res.body.token, undefined);
    const mixed = await request(app)
      .post('/api/auth/login')
      .send({ email: 'user@example.com', password: { $ne: null } });
    assert.equal(mixed.status, 400);
    assert.equal(mixed.body.token, undefined);
  });
});

describe('password reset', () => {
  beforeEach(async () => {
    await register();
    sentEmails.length = 0;
  });

  const forgot = (email, origin) => {
    const req = request(app).post('/api/auth/forgot-password');
    if (origin) req.set('Origin', origin).set('Host', 'evil.example');
    return req.send({ email });
  };

  it('returns the same message for known and unknown emails', async () => {
    const known = await forgot('user@example.com');
    const unknown = await forgot('nobody@example.com');
    assert.equal(known.status, 200);
    assert.equal(unknown.status, 200);
    assert.deepEqual(known.body, unknown.body);
    assert.equal(sentEmails.length, 1);
  });

  it('rejects NoSQL operator payloads and sends nothing', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: { $ne: null } });
    assert.equal(res.status, 400);
    assert.equal(sentEmails.length, 0);
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: { $ne: null }, password: 'N3w!Password' });
    assert.equal(reset.status, 400);
  });

  it('works end to end, uses FRONTEND_URL, revokes old tokens and is single use', async () => {
    const oldToken = (await login()).body.token;

    const res = await forgot('user@example.com', 'https://evil.example');
    assert.equal(res.status, 200);
    assert.equal(sentEmails.length, 1);
    const match = sentEmails[0].html.match(RESET_URL_RE);
    assert.ok(match, 'reset link present in email');
    const resetUrl = new URL(match[1]);
    assert.equal(resetUrl.origin, 'https://app.rapidroutines.test');
    assert.doesNotMatch(sentEmails[0].html, /evil\.example/);

    const resetToken = match[2];
    const stored = await User.findOne({ email: 'user@example.com' });
    assert.notEqual(stored.resetPasswordToken, resetToken);

    const weak = await request(app).post('/api/auth/reset-password').send({ token: resetToken, password: 'weak' });
    assert.equal(weak.status, 400);

    const newPassword = 'N3w!Password';
    const done = await request(app).post('/api/auth/reset-password').send({ token: resetToken, password: newPassword });
    assert.equal(done.status, 200);

    assert.equal((await request(app).get('/api/auth/user').set(bearer(oldToken))).status, 401);
    assert.equal((await login()).status, 400);
    assert.equal((await login('user@example.com', newPassword)).status, 200);

    const again = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'An0ther!Password' });
    assert.equal(again.status, 400);
    assert.equal((await login('user@example.com', newPassword)).status, 200);
  });

  it('rejects an expired reset token', async () => {
    await forgot('user@example.com');
    const resetToken = sentEmails[0].html.match(RESET_URL_RE)[2];
    await User.updateOne({ email: 'user@example.com' }, { resetPasswordExpires: new Date(Date.now() - 1000) });
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'N3w!Password' });
    assert.equal(res.status, 400);
  });
});

describe('update-profile', () => {
  let token;
  beforeEach(async () => {
    token = (await register()).body.token;
    await register({ email: 'taken@example.com', name: 'Taken' });
  });

  it('changes the name without a password', async () => {
    const res = await request(app).put('/api/auth/update-profile').set(bearer(token)).send({ name: 'New Name' });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.name, 'New Name');
    assert.equal(res.body.token, undefined);
  });

  it('rejects a name with markup', async () => {
    const res = await request(app)
      .put('/api/auth/update-profile')
      .set(bearer(token))
      .send({ name: '<img src=x onerror=alert(1)>' });
    assert.equal(res.status, 400);
  });

  it('requires currentPassword to change email', async () => {
    const missing = await request(app)
      .put('/api/auth/update-profile')
      .set(bearer(token))
      .send({ name: 'Test User', email: 'new@example.com' });
    assert.equal(missing.status, 403);

    const wrong = await request(app)
      .put('/api/auth/update-profile')
      .set(bearer(token))
      .send({ name: 'Test User', email: 'new@example.com', currentPassword: 'Wr0ng!Password' });
    assert.equal(wrong.status, 403);

    const operator = await request(app)
      .put('/api/auth/update-profile')
      .set(bearer(token))
      .send({ name: 'Test User', email: 'new@example.com', currentPassword: { $ne: null } });
    assert.equal(operator.status, 403);

    assert.equal(await User.findOne({ email: 'new@example.com' }), null);
  });

  it('changes email with the password, issues a new token and revokes the old one', async () => {
    const res = await request(app)
      .put('/api/auth/update-profile')
      .set(bearer(token))
      .send({ name: 'Test User', email: 'New@Example.com', currentPassword: PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.body.user.email, 'new@example.com');
    assert.ok(res.body.token);
    assert.equal((await request(app).get('/api/auth/user').set(bearer(token))).status, 401);
    assert.equal((await request(app).get('/api/auth/user').set(bearer(res.body.token))).status, 200);
  });

  it('clears pending reset tokens and notifies the old address on email change', async () => {
    await request(app).post('/api/auth/forgot-password').send({ email: 'user@example.com' });
    const resetToken = sentEmails.find((m) => m.subject === 'Reset your password').html.match(RESET_URL_RE)[2];
    sentEmails.length = 0;

    const res = await request(app)
      .put('/api/auth/update-profile')
      .set(bearer(token))
      .send({ name: 'Test User', email: 'moved@example.com', currentPassword: PASSWORD });
    assert.equal(res.status, 200);

    const stored = await User.findOne({ email: 'moved@example.com' });
    assert.equal(stored.resetPasswordToken, undefined);
    assert.equal(stored.resetPasswordExpires, undefined);
    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: resetToken, password: 'N3w!Password' });
    assert.equal(reset.status, 400);

    assert.equal(sentEmails.length, 1);
    assert.equal(sentEmails[0].to, 'user@example.com');
    assert.match(sentEmails[0].subject, /email was changed/);
    assert.doesNotMatch(sentEmails[0].html, /moved@example\.com/);
  });

  it('sends no notice for a name-only change', async () => {
    sentEmails.length = 0;
    const res = await request(app).put('/api/auth/update-profile').set(bearer(token)).send({ name: 'Renamed' });
    assert.equal(res.status, 200);
    assert.equal(sentEmails.length, 0);
  });

  it('does not allow taking an existing email', async () => {
    const res = await request(app)
      .put('/api/auth/update-profile')
      .set(bearer(token))
      .send({ name: 'Test User', email: 'taken@example.com', currentPassword: PASSWORD });
    assert.equal(res.status, 400);
    assert.equal((await User.findOne({ email: 'user@example.com' })).name, 'Test User');
  });
});

describe('delete-account', () => {
  let token;
  beforeEach(async () => {
    token = (await register()).body.token;
    await request(app)
      .post('/api/user-data/save-data')
      .set(bearer(token))
      .send({ dataType: 'savedExercises', data: [{ name: 'Push-up' }] });
  });

  it('requires the current password', async () => {
    const missing = await request(app).delete('/api/auth/delete-account').set(bearer(token));
    assert.equal(missing.status, 403);
    const wrong = await request(app)
      .delete('/api/auth/delete-account')
      .set(bearer(token))
      .send({ currentPassword: 'Wr0ng!Password' });
    assert.equal(wrong.status, 403);
    assert.equal(await User.countDocuments(), 1);
    assert.equal(await UserData.countDocuments(), 1);
  });

  it('removes the user and their data', async () => {
    const res = await request(app)
      .delete('/api/auth/delete-account')
      .set(bearer(token))
      .send({ currentPassword: PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(await User.countDocuments(), 0);
    assert.equal(await UserData.countDocuments(), 0);
    assert.equal((await request(app).get('/api/auth/user').set(bearer(token))).status, 401);
  });
});

describe('email configuration', () => {
  const { spawnSync } = require('child_process');
  const loadConfig = (env) =>
    spawnSync(
      process.execPath,
      [
        '-e',
        "require('./utils/resend.config').resendClient.emails.send({ to: 'a@example.com', subject: 'Reset', html: '<a href=\"https://x.test/r/1\">r</a>' }).then((r) => console.log(JSON.stringify(r)))",
      ],
      { cwd: require('path').join(__dirname, '..'), env: { ...process.env, RESEND_API_KEY: '', ...env }, encoding: 'utf8' },
    );

  it('logs emails to the console when RESEND_API_KEY is unset outside production', () => {
    const out = loadConfig({ NODE_ENV: 'development' });
    assert.equal(out.status, 0, out.stderr);
    assert.match(out.stdout, /email not sent.*a@example\.com.*https:\/\/x\.test\/r\/1/);
  });

  it('refuses to start without RESEND_API_KEY in production', () => {
    const out = loadConfig({ NODE_ENV: 'production' });
    assert.notEqual(out.status, 0);
    assert.match(out.stderr, /RESEND_API_KEY is not set/);
  });
});
