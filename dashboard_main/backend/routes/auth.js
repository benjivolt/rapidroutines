const express = require('express');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const UserData = require('../models/user-data');
const auth = require('../middleware/auth');
const { loginLimiter, accountLimiter } = require('../lib/rate-limit');
const { PASSWORD_RULES, isEmail, isPassword, isName, isString } = require('../lib/validate');
const { sendPasswordResetEmail, sendResetSuccessEmail, sendWelcomeEmail } = require('../utils/emailService');

const router = express.Router();
const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://rapidroutines.org').replace(/\/$/, '');
const RESET_WINDOW_MS = 60 * 60 * 1000;
const RESET_SENT = 'If an account exists for that email, a reset link is on its way.';
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);

const signToken = (user) =>
  jwt.sign({ id: user.id, tv: user.tokenVersion || 0 }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '7d',
  });

const publicUser = (user) => ({
  id: user.id,
  name: user.name,
  email: user.email,
  joined: user.joined,
  lastLogin: user.lastLogin,
});

const normalizeEmail = (email) => String(email).trim().toLowerCase();
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

router.post('/register', accountLimiter, async (req, res) => {
  const { name, email, password } = req.body;
  if (!isName(name)) {
    return res.status(400).json({ message: 'Enter a name up to 50 characters.' });
  }
  if (!isEmail(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }
  if (!isPassword(password)) {
    return res.status(400).json({ message: PASSWORD_RULES });
  }

  try {
    const normalized = normalizeEmail(email);
    if (await User.exists({ email: normalized })) {
      return res.status(400).json({ message: 'Could not create an account with that email.' });
    }

    const user = await User.create({ name: name.trim(), email: normalized, password });
    sendWelcomeEmail(user.email, user.name).catch((err) => console.error('Welcome email failed:', err.message));
    res.status(201).json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('Register failed:', err.message);
    res.status(500).json({ message: 'Could not create the account. Try again.' });
  }
});

router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;
  if (!isEmail(email) || !isString(password, 128)) {
    return res.status(400).json({ message: 'Incorrect email or password.' });
  }

  try {
    const user = await User.findOne({ email: normalizeEmail(email) });
    const matches = user ? await user.matchPassword(password) : await bcrypt.compare(password, DUMMY_HASH);
    if (!user || !matches) {
      return res.status(400).json({ message: 'Incorrect email or password.' });
    }

    user.lastLogin = Date.now();
    await user.save();
    res.json({ token: signToken(user), user: publicUser(user) });
  } catch (err) {
    console.error('Login failed:', err.message);
    res.status(500).json({ message: 'Could not sign in. Try again.' });
  }
});

router.get('/user', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error('Load user failed:', err.message);
    res.status(500).json({ message: 'Could not load your account.' });
  }
});

router.post('/logout', auth, async (req, res) => {
  try {
    await User.updateOne({ _id: req.user.id }, { $inc: { tokenVersion: 1 } });
    res.json({ message: 'Signed out on all devices.' });
  } catch (err) {
    console.error('Logout failed:', err.message);
    res.status(500).json({ message: 'Could not sign out. Try again.' });
  }
});

router.post('/forgot-password', accountLimiter, async (req, res) => {
  const { email } = req.body;
  if (!isEmail(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  try {
    const user = await User.findOne({ email: normalizeEmail(email) });
    if (user) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      user.resetPasswordToken = hashToken(resetToken);
      user.resetPasswordExpires = Date.now() + RESET_WINDOW_MS;
      await user.save();
      sendPasswordResetEmail(user.email, `${FRONTEND_URL}/dashboard/reset-password/${resetToken}`).catch((err) =>
        console.error('Reset email failed:', err.message),
      );
    }
  } catch (err) {
    console.error('Forgot password failed:', err.message);
  }
  res.json({ message: RESET_SENT });
});

router.post('/reset-password', accountLimiter, async (req, res) => {
  const { token, password } = req.body;
  if (!isString(token, 128)) {
    return res.status(400).json({ message: 'This reset link is invalid or has expired.' });
  }
  if (!isPassword(password)) {
    return res.status(400).json({ message: PASSWORD_RULES });
  }

  try {
    const user = await User.findOne({
      resetPasswordToken: hashToken(token),
      resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
      return res.status(400).json({ message: 'This reset link is invalid or has expired.' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    sendResetSuccessEmail(user.email).catch((err) => console.error('Reset confirmation failed:', err.message));
    res.json({ message: 'Password updated. Sign in with your new password.' });
  } catch (err) {
    console.error('Reset password failed:', err.message);
    res.status(500).json({ message: 'Could not reset the password. Try again.' });
  }
});

router.put('/update-profile', auth, async (req, res) => {
  const { name, email, currentPassword } = req.body;
  if (!isName(name)) {
    return res.status(400).json({ message: 'Enter a name up to 50 characters.' });
  }
  if (email !== undefined && !isEmail(email)) {
    return res.status(400).json({ message: 'Enter a valid email address.' });
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Account not found.' });

    user.name = name.trim();
    let token;
    const nextEmail = email === undefined ? user.email : normalizeEmail(email);
    if (nextEmail !== user.email) {
      if (!isString(currentPassword, 128) || !(await user.matchPassword(currentPassword))) {
        return res.status(403).json({ message: 'Enter your current password to change your email.' });
      }
      if (await User.exists({ email: nextEmail })) {
        return res.status(400).json({ message: 'That email is already in use.' });
      }
      user.email = nextEmail;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      token = signToken(user);
    }

    await user.save();
    res.json({ user: publicUser(user), ...(token && { token }) });
  } catch (err) {
    console.error('Update profile failed:', err.message);
    res.status(500).json({ message: 'Could not update your profile.' });
  }
});

router.delete('/delete-account', auth, async (req, res) => {
  const { currentPassword } = req.body || {};
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'Account not found.' });
    if (!isString(currentPassword, 128) || !(await user.matchPassword(currentPassword))) {
      return res.status(403).json({ message: 'Enter your current password to delete your account.' });
    }

    await UserData.deleteOne({ user: user.id });
    await User.deleteOne({ _id: user.id });
    res.json({ message: 'Your account and data were deleted.' });
  } catch (err) {
    console.error('Delete account failed:', err.message);
    res.status(500).json({ message: 'Could not delete the account.' });
  }
});

module.exports = router;
