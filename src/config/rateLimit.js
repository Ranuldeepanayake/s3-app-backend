// Rate limiting configuration for API endpoints.

const rateLimit = require('express-rate-limit');
const logger = require('./logger');

// Read rate limit parameters from environment variables with sensible defaults.
// windowMs: time window in milliseconds (default 15 minutes)
// max: maximum number of requests per windowMs (default 100)
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 100);

// Custom key generator to extract real client IP, accounting for proxies.
const getRealIp = (req) => {
  return (
    req.ip ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket?.remoteAddress ||
    'unknown'
  );
};

// Create the rate limiter with custom logging on limit exceeded.
const createApiRateLimiter = (moduleName = 'API') => {
  return rateLimit({
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX_REQUESTS,
    standardHeaders: false,
    skip: () => false,

    // Handler called when rate limit is exceeded.
    handler: (req, res) => {
      const clientIp = getRealIp(req);
      logger.warn(
        'RATE_LIMIT',
        `Rate limit exceeded for ${moduleName}`,
        {
          ip: clientIp,
          method: req.method,
          path: req.originalUrl,
          module: moduleName
        }
      );

      res.status(429).json({
        message: `Rate limit exceeded. Maximum ${RATE_LIMIT_MAX_REQUESTS} requests per ${Math.round(RATE_LIMIT_WINDOW_MS / 1000)} seconds.`,
        retryAfter: Math.ceil(RATE_LIMIT_WINDOW_MS / 1000)
      });
    }
  });
};

// Log rate limit configuration at startup.
const logRateLimitConfiguration = () => {
  logger.info('RATE_LIMIT', 'Configuration loaded', {
    windowMs: RATE_LIMIT_WINDOW_MS,
    max: RATE_LIMIT_MAX_REQUESTS,
    windowSeconds: Math.round(RATE_LIMIT_WINDOW_MS / 1000),
    description: `Limit of ${RATE_LIMIT_MAX_REQUESTS} requests per ${Math.round(RATE_LIMIT_WINDOW_MS / 1000)} seconds`
  });
};

module.exports = {
  createApiRateLimiter,
  logRateLimitConfiguration,
  getRealIp,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_REQUESTS
};
