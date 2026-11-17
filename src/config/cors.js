// Provides the API's origin allowlist and CORS middleware. Origins are read
// from CORS_ALLOWED_ORIGINS; requests without an Origin header remain usable by
// server-to-server clients, which are not governed by browser CORS.

const logger = require('./logger');

const ALLOWED_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'];
const ALLOWED_HEADERS = ['authorization', 'content-type', 'accept', 'x-requested-with'];
const DEFAULT_ORIGINS = ['http://localhost:3000', 'http://localhost:3300'];

/**
 * Parses a comma-separated origin allowlist, removing whitespace and trailing
 * slashes so configuration entries compare consistently with browser origins.
 * @param {string|undefined} value CORS_ALLOWED_ORIGINS environment value.
 * @returns {string[]} Normalized origins, or the local development default.
 */
const parseAllowedOrigins = (value) => {
  if (value === undefined) {
    return [...DEFAULT_ORIGINS];
  }

  return value
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter(Boolean);
};

/**
 * Creates middleware enforcing the configured browser origin allowlist.
 * Allowed preflight requests receive explicit method/header permissions;
 * disallowed origins and preflight capabilities are rejected before routing.
 * @param {string[]} allowedOrigins Origins permitted to access the API.
 * @returns {import('express').RequestHandler} Express CORS enforcement middleware.
 */
const createCorsMiddleware = (allowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS)) => {
  const originSet = new Set(allowedOrigins);

  return (req, res, next) => {
    const origin = req.get('Origin');

    // CORS is a browser policy. Requests without Origin are non-browser or
    // same-network clients and should continue through normal API controls.
    if (!origin) {
      return next();
    }

    if (!originSet.has(origin)) {
      logger.warn('CORS', 'Rejected request from disallowed origin', {
        origin,
        method: req.method
      });
      return res.status(403).json({ message: 'Origin is not allowed.' });
    }

    res.vary('Origin');
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Access-Control-Expose-Headers', 'X-Request-Id');

    if (req.method !== 'OPTIONS') {
      return next();
    }

    const requestedMethod = req.get('Access-Control-Request-Method');
    const requestedHeaders = (req.get('Access-Control-Request-Headers') || '')
      .split(',')
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean);

    if (requestedMethod && !ALLOWED_METHODS.includes(requestedMethod.toUpperCase())) {
      return res.status(403).json({ message: 'Requested CORS method is not allowed.' });
    }

    if (requestedHeaders.some((header) => !ALLOWED_HEADERS.includes(header))) {
      return res.status(403).json({ message: 'Requested CORS headers are not allowed.' });
    }

    res.set('Access-Control-Allow-Methods', ALLOWED_METHODS.join(', '));
    res.set('Access-Control-Allow-Headers', ALLOWED_HEADERS.join(', '));
    res.set('Access-Control-Max-Age', '600');
    return res.sendStatus(204);
  };
};

module.exports = { parseAllowedOrigins, createCorsMiddleware };
