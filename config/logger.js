const formatTimestamp = () => new Date().toISOString();

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
