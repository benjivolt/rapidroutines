const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const nodePath = require('path');
const { app, rawGet } = require('./helpers');
const { PUBLIC_DIRS, PUBLIC_PAGES, isSafePath, isPublicPath } = require('../lib/public-paths');

const POSIX_BACKSLASH_VECTOR = '/dashboard_main/x%5c..%5c..%5c..%5cfoo/%2e%2e/backend/app.js';

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
    '/render.yaml',
    '/SECURITY.md',
    '/README.md',
    '/.github/workflows/ci.yml',
    '/dashboard_main/package.json',
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
    POSIX_BACKSLASH_VECTOR,
    '/css/x%5c..%5c..%5cfoo/%2e%2e/%2e%2e/dashboard_main/backend/app.js',
    '/css/%2e%2e/dashboard_main/backend/app.js',
    '/css/..%2f..%2fdashboard_main/backend/app.js',
    '/dashboard/x%5c..%5c..%5cfoo/%2e%2e/%2e%2e/backend/app.js',
    '/chatbot/%00/app.js',
    '/js/%2e%2e%5cdashboard_main/backend/app.js',
  ]) {
    it(`encoded or non-normalized ${path} returns 404 without source`, async () => {
      const res = await rawGet(path);
      assert.equal(res.status, 404);
      assert.doesNotMatch(res.body, /require\(|"dependencies"|module\.exports/);
    });
  }
});

describe('public path guard', () => {
  it('rejects the posix backslash traversal vector', () => {
    assert.equal(isSafePath(POSIX_BACKSLASH_VECTOR), false);
    assert.equal(isPublicPath(POSIX_BACKSLASH_VECTOR), false);
  });

  it('rejects backslashes, NUL bytes, dot segments and bad encodings', () => {
    for (const raw of ['/css/a%5cb.css', '/css/a\\b.css', '/css/%00', '/css/../x', '/css/%2e%2e/x', '/.env', '/%E0%A4%A']) {
      assert.equal(isSafePath(raw), false, raw);
    }
  });

  it('only allows the public top-level entries and pages', () => {
    for (const raw of ['/', '/about', '/about.html', '/faq', '/css/main.css', '/dashboard/', '/repbot/script.js']) {
      assert.equal(isPublicPath(raw), true, raw);
    }
    for (const raw of ['/render.yaml', '/README.md', '/SECURITY.md', '/package.json', '/dashboard_main/x', '/about/x', '//x']) {
      assert.equal(isPublicPath(raw), false, raw);
    }
  });

  it('never accepts a path that resolves outside an allowlisted entry on posix or win32', () => {
    const vectors = [
      POSIX_BACKSLASH_VECTOR,
      '/css/x%5c..%5c..%5cfoo/%2e%2e/%2e%2e/dashboard_main/backend/app.js',
      '/css/..%2f..%2fdashboard_main/backend/app.js',
      '/css/%252e%252e/x',
      '/images/a/b/../../../render.yaml',
      '/css/main.css',
      '/about',
    ];
    const allowed = new Set([...PUBLIC_DIRS, 'dashboard', '', ...PUBLIC_PAGES.flatMap((p) => [p, `${p}.html`])]);
    for (const raw of vectors.filter(isPublicPath)) {
      for (const impl of [nodePath.posix, nodePath.win32]) {
        const resolved = impl.normalize(`.${impl.sep}${decodeURIComponent(raw)}`).split(/[\\/]/);
        assert.ok(allowed.has(resolved[0] === '.' ? resolved[1] : resolved[0]), `${raw} -> ${resolved.join('/')}`);
        assert.ok(!resolved.includes('..'), raw);
      }
    }
  });
});

describe('public site', () => {
  it('serves the pages with clean URLs and no-cache', async () => {
    for (const [url, title] of [
      ['/', /Home - RapidRoutines/],
      ['/about', /About - RapidRoutines/],
      ['/about/', /About - RapidRoutines/],
      ['/faq.html', /FAQ - RapidRoutines/],
      ['/contact-us', /Contact Us - RapidRoutines/],
      ['/testimonials', /Testimonials - RapidRoutines/],
    ]) {
      const res = await request(app).get(url);
      assert.equal(res.status, 200, url);
      assert.match(res.text, title, url);
      assert.equal(res.headers['cache-control'], 'no-cache', url);
    }
  });

  it('serves the standalone apps and the dashboard SPA fallback', async () => {
    for (const url of ['/chatbot/', '/repbot/', '/exercise-tracker/', '/dashboard/', '/dashboard/profile']) {
      const res = await request(app).get(url);
      assert.equal(res.status, 200, url);
      assert.match(res.headers['content-type'], /text\/html/, url);
    }
  });

  it('returns 404 with the home page for unknown paths', async () => {
    const res = await request(app).get('/no-such-page');
    assert.equal(res.status, 404);
    assert.match(res.text, /Home - RapidRoutines/);
  });

  it('compresses CSS and caches assets for a week', async () => {
    const res = await request(app).get('/css/main.css').set('Accept-Encoding', 'gzip');
    assert.equal(res.status, 200);
    assert.equal(res.headers['content-encoding'], 'gzip');
    assert.equal(res.headers['cache-control'], 'public, max-age=604800');
  });

  it('caches hashed dashboard assets for a year', async () => {
    const html = (await request(app).get('/dashboard/')).text;
    const asset = html.match(/\/dashboard\/assets\/[^"]+\.js/)[0];
    const res = await request(app).get(asset);
    assert.equal(res.status, 200);
    assert.equal(res.headers['cache-control'], 'public, max-age=31536000, immutable');
  });
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
