// Express trust proxy configuration for deployments behind ingress/load balancers.

const logger = require('./logger');

const parseTrustProxy = (value) => {
  if (value === undefined || value === null || value === '') {
    return false;
  }

  const normalized = String(value).trim().toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  const numericValue = Number(normalized);
  if (Number.isInteger(numericValue) && numericValue >= 0) {
    return numericValue;
  }

  return String(value).trim();
};

const configureTrustProxy = (app) => {
  const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
  app.set('trust proxy', trustProxy);

  logger.info('STARTUP', 'Trust proxy configuration loaded', {
    trustProxy
  });

  return trustProxy;
};

module.exports = {
  configureTrustProxy,
  parseTrustProxy
};
