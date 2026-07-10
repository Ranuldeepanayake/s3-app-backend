// Small logging wrapper that keeps console output consistent without pulling in
// a full logging framework.

const formatTimestamp = () => new Date().toISOString();

// The component label makes it easier to filter logs by subsystem in Docker or
// cloud log viewers.
const logWithContext = (level, component, message, meta) => {
  const base = `[${formatTimestamp()}] [${component}] ${message}`;
  if (meta !== undefined) {
    if (typeof meta === 'object') {
      console[level](base, meta);
    } else {
      console[level](base, meta);
    }
    return;
  }
  console[level](base);
};

const logger = {
  info: (component, message, meta) => logWithContext('info', component, message, meta),
  warn: (component, message, meta) => logWithContext('warn', component, message, meta),
  error: (component, message, meta) => logWithContext('error', component, message, meta)
};

module.exports = logger;
