require('dotenv').config();

const required = ['MONGO_URI', 'JWT_SECRET', ...(process.env.NODE_ENV === 'production' ? ['RESEND_API_KEY'] : [])];
for (const name of required) {
  if (!process.env[name]) {
    console.error(`${name} is not set`);
    process.exit(1);
  }
}
if (process.env.JWT_SECRET.length < 32) {
  console.warn('JWT_SECRET is shorter than 32 characters. Replace it with a long random value.');
}

const mongoose = require('mongoose');
const app = require('./app');

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI, { serverSelectionTimeoutMS: 10000 })
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`RapidRoutines running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
