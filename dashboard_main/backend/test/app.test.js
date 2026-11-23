const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app, rawGet } = require('./helpers');

describe('private paths', () => {
  for (const path of [
    '/.git/HEAD',
    '/.env',
    '/dashboard_main/backend/app.js',
    '/dashboard_main/backend/.env',
    '/package.json',
    '/package-lock.json',
    '/node_modules/x',
    '/vercel.json',
  ]) {
    it(`${path} returns 404`, async () => {
      const res = await request(app).get(path);
      assert.equal(res.status, 404);
      assert.doesNotMatch(res.text, /require\(/);
    });
  }

  for (const path of [
    '//dashboard_main/backend/app.js',
    '/dashboard%5Fmain/backend/app.js',
    '/%64ashboard_main/backend/app.js',
    '/x/../dashboard_main/backend/app.js',
    '/x/%2e%2e/dashboard_main/backend/app.js',
    '/%2Egit/HEAD',
    '/%5Cdashboard_main/backend/app.js',
    '/Package.json',
    '/%E0%A4%A',
  ]) {
    it(`encoded or non-normalized ${path} does not leak source`, async () => {
      const res = await rawGet(path);
      assert.ok(res.status === 404 || res.status === 400 || res.status === 403, `status ${res.status}`);
      assert.doesNotMatch(res.body, /require\(|"dependencies"/);
    });
  }
});

describe('security headers', () => {
  it('sets CSP, frame, nosniff and hides x-powered-by', async () => {
    const res = await request(app).get('/api');
    assert.equal(res.status, 200);
    assert.match(res.headers['content-security-policy'], /default-src 'self'/);
    assert.match(res.headers['content-security-policy'], /frame-ancestors 'self'/);
    assert.equal(res.headers['x-frame-options'], 'SAMEORIGIN');
    assert.equal(res.headers['x-content-type-options'], 'nosniff');
    assert.equal(res.headers['x-powered-by'], undefined);
    assert.ok(res.headers['strict-transport-security']);
    assert.ok(res.headers['permissions-policy']);
  });
});

describe('CORS', () => {
  it('omits Access-Control-Allow-Origin for a disallowed origin', async () => {
    const res = await request(app).get('/api').set('Origin', 'https://evil.example');
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });

  it('omits it on preflight for a disallowed origin', async () => {
    const res = await request(app)
      .options('/api/auth/login')
      .set('Origin', 'https://evil.example')
      .set('Access-Control-Request-Method', 'POST');
    assert.equal(res.headers['access-control-allow-origin'], undefined);
  });

  it('echoes an allowed origin', async () => {
    const res = await request(app).get('/api').set('Origin', 'https://rapidroutines.org');
    assert.equal(res.headers['access-control-allow-origin'], 'https://rapidroutines.org');
  });
});

describe('API fallbacks', () => {
  it('returns JSON 404 for an unknown /api route', async () => {
    const res = await request(app).get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.match(res.headers['content-type'], /application\/json/);
    assert.deepEqual(res.body, { message: 'Not found' });
  });

  it('returns a generic body for malformed JSON', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": "a@b.co", bad');
    assert.equal(res.status, 400);
    assert.deepEqual(res.body, { message: 'Something went wrong.' });
  });

  it('returns 413 with a generic body for an oversized JSON body', async () => {
    const res = await request(app)
      .post('/api/contact')
      .send({ message: 'x'.repeat(320 * 1024) });
    assert.equal(res.status, 413);
    assert.deepEqual(res.body, { message: 'Request too large.' });
  });
});

describe('contact', () => {
  const contact = (body) => request(app).post('/api/contact').send(body);

  it('requires name, email and message', async () => {
    const res = await contact({ name: 'A', email: 'a@example.com' });
    assert.equal(res.status, 400);
  });

  it('rejects an invalid email', async () => {
    const res = await contact({ name: 'A', email: 'nope', message: 'hi' });
    assert.equal(res.status, 400);
  });

  it('fails generically when SMTP is not configured', async () => {
    delete process.env.ZOHO_SMTP_USER;
    delete process.env.ZOHO_SMTP_PASS;
    const res = await contact({ name: 'A', email: 'a@example.com', message: 'hi' });
    assert.equal(res.status, 500);
    assert.deepEqual(res.body, { message: 'Unable to send message right now.' });
  });
});
