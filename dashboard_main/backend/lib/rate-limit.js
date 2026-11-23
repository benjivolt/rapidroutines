const { rateLimit } = require('express-rate-limit');

const skipInTests = () => process.env.NODE_ENV === 'test' && process.env.RATE_LIMIT_IN_TESTS !== 'true';

const createLimiter = (windowMinutes, limit, message, options = {}) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { message },
    ...options,
    skip: (req, res) => skipInTests() || Boolean(options.skip?.(req, res)),
  });

const byUser = (req) => `user:${req.user.id}`;
const byEmail = (req) => {
  const email = req.body?.email;
  return typeof email === 'string' && email.length <= 254 ? `email:${email.trim().toLowerCase()}` : `ip:${req.ip}`;
};

module.exports = {
  createLimiter,
  loginLimiter: createLimiter(15, 10, 'Too many sign-in attempts. Try again in 15 minutes.'),
  registerLimiter: createLimiter(60, 5, 'Too many sign-ups from this network. Try again in an hour.'),
  forgotIpLimiter: createLimiter(60, 10, 'Too many reset requests. Try again in an hour.'),
  forgotEmailLimiter: createLimiter(60, 3, 'Too many reset requests for this email. Try again in an hour.', {
    keyGenerator: byEmail,
  }),
  resetLimiter: createLimiter(60, 10, 'Too many reset attempts. Try again in an hour.'),
  profileLimiter: createLimiter(15, 30, 'Too many profile updates. Try again in 15 minutes.', {
    keyGenerator: byUser,
  }),
  passwordCheckLimiter: createLimiter(15, 5, 'Too many password attempts. Try again in 15 minutes.', {
    keyGenerator: byUser,
    skip: (req) => req.method === 'PUT' && req.body?.currentPassword === undefined,
  }),
  contactLimiter: createLimiter(60, 5, 'Too many messages. Try again in an hour.'),
  chatbotLimiter: createLimiter(1, 15, 'Too many messages. Wait a minute and try again.'),
  repbotLimiter: createLimiter(1, 2400, 'Too many requests.'),
  dataLimiter: createLimiter(1, 60, 'Too many requests.'),
};
