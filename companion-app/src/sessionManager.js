const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const SECRET_KEY = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

const SESSION_EXPIRY_MINUTES = 2;

function generateSessionToken(origin, com, baud) {
  const payload = {
    origin,
    com,
    baud,
    type: 'session',
    iat: Math.floor(Date.now() / 1000),
  };
  
  const token = jwt.sign(payload, SECRET_KEY, {
    expiresIn: `${SESSION_EXPIRY_MINUTES}m`,
  });
  
  const expiresAt = new Date(Date.now() + SESSION_EXPIRY_MINUTES * 60 * 1000);
  
  return {
    token,
    expiresAt,
    payload,
  };
}

function verifySessionToken(token) {
  try {
    const decoded = jwt.verify(token, SECRET_KEY);
    
    if (decoded.type !== 'session') {
      throw new Error('Invalid token type');
    }
    
    return {
      valid: true,
      payload: decoded,
    };
  } catch (error) {
    return {
      valid: false,
      error: error.message,
    };
  }
}

module.exports = {
  generateSessionToken,
  verifySessionToken,
  SECRET_KEY,
};
