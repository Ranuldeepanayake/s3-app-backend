/* 
Express trust proxy configuration for deployments behind ingress/load balancers.
When the app is behind a reverse proxy (like Nginx, HAProxy, or a cloud load balancer), Express needs to be configured to trust the proxy in order to 
correctly interpret the `X-Forwarded-*` headers. This is important for determining the client's IP address, protocol (HTTP/HTTPS), and other request properties.
Otherwise, Express may incorrectly assume that the request is coming from the proxy itself, which can lead to issues with rate limiting, logging, and security checks.
*/

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
