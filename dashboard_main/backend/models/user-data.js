const mongoose = require('mongoose');

const { Mixed, ObjectId } = mongoose.Schema.Types;

const UserDataSchema = new mongoose.Schema({
  user: { type: ObjectId, ref: 'User', required: true, unique: true },
  savedExercises: { type: [Mixed], default: [] },
  exerciseLog: { type: [Mixed], default: [] },
  chatHistory: { type: [Mixed], default: [] },
  rapidTreeProgress: { type: Mixed, default: {} },
  trackerExercises: { type: [Mixed], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

UserDataSchema.pre('save', function touch(next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model('UserData', UserDataSchema);
