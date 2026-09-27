//Routes for authentication and JWT token generation.

const express = require('express');
const jwt = require('jsonwebtoken');
const { createApiRateLimiter } = require('../config/rateLimit.js');
const postgres = require('../config/postgres.js');

const router = express.Router();

// Strict rate limiting for login attempts to prevent brute force attacks.
const loginRateLimiter = createApiRateLimiter('AUTH_LOGIN');

const getJwtSecret = () => process.env.JWT_SECRET || 'change-me';
const tokenExpiration = process.env.JWT_EXPIRATION || '12h';

// Middleware to authenticate requests using JWT bearer tokens. Successful
// verification stores the decoded payload on req.user for later handlers.
const authenticateToken = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required.' });
  }

  jwt.verify(token, getJwtSecret(), (error, payload) => {
    if (error) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }

    req.user = payload;
    next();
  });
};

// Login uses a parameterized query against PostgreSQL. Passwords are plaintext
// only because this application's requested database contract requires it.
router.post('/login', loginRateLimiter, async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  try {
    const result = await postgres.query(
      `SELECT user_id, user_name, first_name
       FROM public.app_users
       WHERE user_name = $1 AND password = $2
       LIMIT 1`,
      [username, password]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign({
      userId: user.user_id,
      username: user.user_name,
      firstName: user.first_name,
      role: 'admin'
    }, getJwtSecret(), {
      expiresIn: tokenExpiration
    });

    return res.json({
      message: 'Login successful.',
      token
    });
  } catch (error) {
    return res.status(503).json({
      message: 'Authentication service is unavailable. Please try again later.'
    });
  }
});

router.get('/test-protected', authenticateToken, (req, res) => {
  return res.json({
    status: 'ok',
    message: 'JWT verified successfully.'
  });
});

module.exports = {
  router,
  authenticateToken
};
