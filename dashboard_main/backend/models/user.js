const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 50 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  password: { type: String, required: true, minlength: 8 },
  tokenVersion: { type: Number, default: 0 },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
  joined: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: Date.now },
});

UserSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, 12);
    next();
  } catch (err) {
    next(err);
  }
});

UserSchema.methods.matchPassword = function matchPassword(entered) {
  return bcrypt.compare(String(entered), this.password);
};

module.exports = mongoose.model('User', UserSchema);
