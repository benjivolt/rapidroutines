const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const compression = require('compression');
const { rateLimit } = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const userDataRoutes = require('./routes/user-data');
const contactRoutes = require('./routes/contact');
const chatbotRoutes = require('./routes/chatbot');
const repbotRoutes = require('./routes/repbot');
const { PUBLIC_DIRS, PUBLIC_PAGES, isPublicPath } = require('./lib/public-paths');

const siteRoot = path.resolve(__dirname, '../..');
const dashboardBuild = [path.resolve(__dirname, '../dist'), path.join(siteRoot, 'dashboard')].find((dir) =>
  fs.existsSync(path.join(dir, 'index.html')),
);
const allowedOrigins = (process.env.CORS_ORIGINS || 'https://rapidroutines.org,https://www.rapidroutines.org')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 2));

// Keep a coarse request ceiling on public/static routes as well as the narrower API limits.
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 3000,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { message: 'Too many requests. Try again in a minute.' },
  skip: () => process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_IN_TESTS !== 'true',
}));

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'wasm-unsafe-eval'",
          'https://cdn.jsdelivr.net',
          'https://cdnjs.cloudflare.com',
        ],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
        fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        mediaSrc: ["'self'", 'blob:', 'https:'],
        connectSrc: ["'self'", 'https://cdn.jsdelivr.net'],
        workerSrc: ["'self'", 'blob:'],
        frameSrc: ["'self'", 'https://www.youtube.com', 'https://docs.google.com'],
        frameAncestors: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    frameguard: { action: 'sameorigin' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  }),
);
app.use((req, res, next) => {
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');
  next();
});

app.use(compression());
app.use(cors({ origin: (origin, done) => done(null, !origin || allowedOrigins.includes(origin)) }));
app.use(express.json({ limit: '300kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/user-data', userDataRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/repbot', repbotRoutes);
app.get('/api', (req, res) => res.json({ status: 'ok' }));
app.all('/api/*', (req, res) => res.status(404).json({ message: 'Not found' }));

const dashboardAssets = dashboardBuild && path.join(dashboardBuild, 'assets') + path.sep;
const setCacheHeaders = (res, filePath) => {
  if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  else if (dashboardAssets && filePath.startsWith(dashboardAssets)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  } else res.setHeader('Cache-Control', 'public, max-age=604800');
};
const staticOptions = { dotfiles: 'deny', index: ['index.html'], redirect: true, setHeaders: setCacheHeaders };
const sendHtml = (file, status = 200) => (req, res) =>
  res.status(status).set('Cache-Control', 'no-cache').sendFile(file);
const notFound = sendHtml(path.join(siteRoot, 'index.html'), 404);

app.use((req, res, next) => (isPublicPath(req.path) ? next() : notFound(req, res)));

if (dashboardBuild) {
  app.use('/dashboard', express.static(dashboardBuild, staticOptions));
  app.get('/dashboard/*', sendHtml(path.join(dashboardBuild, 'index.html')));
} else {
  console.warn('Dashboard build not found. Run npm run build:dashboard.');
}
for (const dir of PUBLIC_DIRS) {
  app.use(`/${dir}`, express.static(path.join(siteRoot, dir), staticOptions));
}
for (const page of PUBLIC_PAGES) {
  const routes = page === 'index' ? ['/', '/index.html'] : [`/${page}`, `/${page}.html`];
  app.get(routes, sendHtml(path.join(siteRoot, `${page}.html`)));
}
app.use(notFound);

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err.stack || err);
  res.status(status).json({ message: status === 413 ? 'Request too large.' : 'Something went wrong.' });
});

module.exports = app;
