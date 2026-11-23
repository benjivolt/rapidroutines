const crypto = require('crypto');
const http = require('http');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = crypto.randomBytes(36).toString('base64url');
process.env.RESEND_API_KEY = 're_test_dummy_key';
process.env.FRONTEND_URL = 'https://app.rapidroutines.test';
process.env.CORS_ORIGINS = 'https://rapidroutines.org,https://www.rapidroutines.org';
process.env.GEMINI_API_KEY = 'test-gemini-key';

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const { resendClient } = require('../utils/resend.config');

const sentEmails = [];
resendClient.emails.send = async (payload) => {
  sentEmails.push(payload);
  return { data: { id: `test-${sentEmails.length}` }, error: null };
};

const app = require('../app');

let mongod;

async function startDb() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
}

async function stopDb() {
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}

async function clearDb() {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  sentEmails.length = 0;
}

function rawGet(path) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, '127.0.0.1', () => {
      const req = http.request({ host: '127.0.0.1', port: server.address().port, path, method: 'GET' }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => server.close(() => resolve({ status: res.statusCode, headers: res.headers, body })));
      });
      req.on('error', (err) => server.close(() => reject(err)));
      req.end();
    });
  });
}

const PASSWORD = 'Str0ng!Passw0rd';

module.exports = { app, sentEmails, startDb, stopDb, clearDb, rawGet, PASSWORD };
