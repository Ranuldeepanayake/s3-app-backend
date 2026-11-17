// Central application logger. Every record is a single JSON line with UTC
// timing, severity, service, component, event, and centrally redacted context.

const SERVICE_NAME = 's3-app-backend';
const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|api.?key|credential|connection.?string|mongodb.?uri)/i;
const SENSITIVE_TEXT = /(\b(?:Bearer|Basic)\s+)[A-Za-z0-9._~+/-]+=*|((?:mongodb(?:\+srv)?|postgres(?:ql)?):\/\/)[^\s/@:]+(?::[^\s/@]*)?@|((?:password|token|secret|api[_-]?key)\s*[=:]\s*)[^\s,;&]+/gi;

/**
 * Redacts inline credential-like values in free-form messages and errors.
 * @param {string} value Message or error text written to the log stream.
 * @returns {string} Text with common authentication values replaced.
 */
const redactText = (value) => value.replace(SENSITIVE_TEXT, '$1$2$3[REDACTED]');

/**
 * Recursively removes sensitive fields and safely serializes Error instances.
 * @param {*} value Metadata supplied by an application component.
 * @returns {*} JSON-safe redacted metadata.
 */
const redactMetadata = (value) => {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: redactText(value.message),
      stack: value.stack ? redactText(value.stack) : undefined,
      code: value.code
    };
  }

  if (Array.isArray(value)) {
    return value.map(redactMetadata);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_KEY.test(key)
        ? '[REDACTED]'
        : redactMetadata(nestedValue)
    ]));
  }

  return typeof value === 'string' ? redactText(value) : value;
};

/**
 * Writes one structured log record to the selected console stream.
 * @param {'info'|'warn'|'error'} level Record severity.
 * @param {string} component Owning subsystem name.
 * @param {string} message Human-readable message and event label.
 * @param {*} metadata Optional safe troubleshooting context or Error.
 * @returns {void}
 */
const logWithContext = (level, component, message, metadata) => {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: SERVICE_NAME,
    component,
    event: message,
    message: redactText(message)
  };

  if (metadata !== undefined) {
    record.metadata = redactMetadata(metadata);
  }

  console[level](JSON.stringify(record));
};

const logger = {
  info: (component, message, metadata) => logWithContext('info', component, message, metadata),
  warn: (component, message, metadata) => logWithContext('warn', component, message, metadata),
  error: (component, message, metadata) => logWithContext('error', component, message, metadata)
};

module.exports = logger;
