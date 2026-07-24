//Routes for authentication and JWT token generation.

const express = require('express');
const jwt = require('jsonwebtoken');

const router = express.Router();

// Credentials are environment-driven for this demo API. Override every default
// below before exposing the service outside local development.
const jwtSecret = process.env.JWT_SECRET || 'change-me';
const authUsername = process.env.AUTH_USERNAME || 'admin';
const authPassword = process.env.AUTH_PASSWORD || 'admin123';
const tokenExpiration = process.env.JWT_EXPIRATION || '12h';

// Middleware to authenticate requests using JWT bearer tokens. Successful
// verification stores the decoded payload on req.user for later handlers.
const authenticateToken = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication token is required.' });
  }

  jwt.verify(token, jwtSecret, (error, payload) => {
    if (error) {
      return res.status(403).json({ message: 'Invalid or expired token.' });
    }

    req.user = payload;
    next();
  });
};

// Login compares the submitted credentials with the configured values and
// returns a short-lived admin token for protected routes.
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};

  if (username === authUsername && password === authPassword) {
    const token = jwt.sign({ username, role: 'admin' }, jwtSecret, {
      expiresIn: tokenExpiration
    });

    return res.json({
      message: 'Login successful.',
      token
    });
  }

  return res.status(401).json({ message: 'Invalid credentials.' });
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
