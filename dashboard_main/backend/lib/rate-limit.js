const { rateLimit } = require('express-rate-limit');

const skipInTests = () => process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_IN_TESTS !== 'true';

const createLimiter = (windowMinutes, limit, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message },
    skip: skipInTests,
  });

module.exports = {
  createLimiter,
  loginLimiter: createLimiter(15, 10, 'Too many sign-in attempts. Try again in 15 minutes.'),
  accountLimiter: createLimiter(60, 5, 'Too many requests. Try again in an hour.'),
  contactLimiter: createLimiter(60, 5, 'Too many messages. Try again in an hour.'),
  chatbotLimiter: createLimiter(1, 15, 'Too many messages. Wait a minute and try again.'),
  repbotLimiter: createLimiter(1, 2400, 'Too many requests.'),
  dataLimiter: createLimiter(1, 60, 'Too many requests.'),
};
