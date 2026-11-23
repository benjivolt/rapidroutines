const fs = require('fs');
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const userDataRoutes = require('./routes/user-data');
const contactRoutes = require('./routes/contact');
const chatbotRoutes = require('./routes/chatbot');
const repbotRoutes = require('./routes/repbot');

const siteRoot = path.resolve(__dirname, '../..');
const dashboardBuild = [path.resolve(__dirname, '../dist'), path.join(siteRoot, 'dashboard')].find((dir) =>
  fs.existsSync(path.join(dir, 'index.html')),
);
const allowedOrigins = (process.env.CORS_ORIGINS || 'https://rapidroutines.org,https://www.rapidroutines.org')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const PRIVATE_PATH =
  /^\/(?:\.|dashboard_main|node_modules|api\/|local-server|package(?:-lock)?\.json|vercel\.json|README)/i;

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 2));

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

app.use(cors({ origin: (origin, done) => done(null, !origin || allowedOrigins.includes(origin)) }));
app.use(express.json({ limit: '300kb' }));

app.use('/api/auth', authRoutes);
app.use('/api/user-data', userDataRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/chatbot', chatbotRoutes);
app.use('/api/repbot', repbotRoutes);
app.get('/api', (req, res) => res.json({ status: 'ok' }));
app.all('/api/*', (req, res) => res.status(404).json({ message: 'Not found' }));

const isPrivatePath = (rawPath) => {
  try {
    return PRIVATE_PATH.test(path.posix.normalize(decodeURIComponent(rawPath).replace(/\\/g, '/')));
  } catch {
    return true;
  }
};

app.use((req, res, next) => (isPrivatePath(req.path) ? res.status(404).send('Not found') : next()));

const staticOptions = { dotfiles: 'deny', index: ['index.html'], extensions: ['html'] };
if (dashboardBuild) {
  app.use('/dashboard', express.static(dashboardBuild, staticOptions));
  app.get('/dashboard/*', (req, res) => res.sendFile(path.join(dashboardBuild, 'index.html')));
} else {
  console.warn('Dashboard build not found. Run npm run build:dashboard.');
}
app.use(express.static(siteRoot, staticOptions));
app.use((req, res) => res.status(404).sendFile(path.join(siteRoot, 'index.html')));

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error(err.stack || err);
  res.status(status).json({ message: status === 413 ? 'Request too large.' : 'Something went wrong.' });
});

module.exports = app;
