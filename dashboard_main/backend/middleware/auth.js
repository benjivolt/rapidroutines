const jwt = require('jsonwebtoken');
const User = require('../models/user');

module.exports = async (req, res, next) => {
  const header = req.header('Authorization') || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) {
    return res.status(401).json({ message: 'Not signed in' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const user = await User.findById(decoded.id).select('tokenVersion');
    if (!user || (user.tokenVersion || 0) !== (decoded.tv || 0)) {
      return res.status(401).json({ message: 'Session expired, please sign in again' });
    }
    req.user = { id: user.id };
    next();
  } catch {
    res.status(401).json({ message: 'Session expired, please sign in again' });
  }
};
