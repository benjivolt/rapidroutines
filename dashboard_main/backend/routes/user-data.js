const express = require('express');
const auth = require('../middleware/auth');
const UserData = require('../models/user-data');
const { dataLimiter } = require('../lib/rate-limit');

const router = express.Router();
const MAX_DATA_BYTES = 256 * 1024;
const DATA_TYPES = ['savedExercises', 'exerciseLog', 'chatHistory', 'rapidTreeProgress', 'trackerExercises'];

router.post('/save-data', dataLimiter, auth, async (req, res) => {
  const { dataType, data } = req.body || {};
  if (!dataType || !data) {
    return res.status(400).json({ message: 'Data type and content are required' });
  }
  const field = DATA_TYPES.find((allowed) => allowed === dataType);
  if (!field) {
    return res.status(400).json({ message: 'Invalid data type' });
  }

  try {
    if (Buffer.byteLength(JSON.stringify(data) || '') > MAX_DATA_BYTES) {
      return res.status(413).json({ message: 'That is more than 256 KB, which is the limit for each kind of saved data.' });
    }
    const updatedUserData = await UserData.findOneAndUpdate(
      { user: req.user.id },
      { $set: { [field]: data, updatedAt: Date.now() }, $setOnInsert: { user: req.user.id } },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true, context: 'query' },
    );
    res.json({ message: 'Data saved successfully', data: updatedUserData });
  } catch (err) {
    console.error(`Saving ${dataType} failed:`, err.message);
    res.status(500).json({ message: 'Could not save your data.' });
  }
});

router.get('/get-data', dataLimiter, auth, async (req, res) => {
  try {
    const userData = await UserData.findOne({ user: req.user.id });
    res.json({
      savedExercises: userData?.savedExercises || [],
      exerciseLog: userData?.exerciseLog || [],
      chatHistory: userData?.chatHistory || [],
      rapidTreeProgress: userData?.rapidTreeProgress || {},
      trackerExercises: userData?.trackerExercises || [],
    });
  } catch (err) {
    console.error('Loading user data failed:', err.message);
    res.status(500).json({ message: 'Server error retrieving data' });
  }
});

module.exports = router;
