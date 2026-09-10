/**
 * PeerBridge — Winston Logger + Audit Log
 * ========================================
 * Structured JSON logging with:
 *   - Console transport (coloured, for development)
 *   - File transport (app.log — all levels)
 *   - File transport (error.log — errors only)
 *   - Audit helper (audit.log — GDPR-style compliance events)
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const LOG_DIR = path.resolve(__dirname, '../../logs');
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Custom log format: timestamp + level + message + metadata
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

/**
 * Console format: coloured, human-readable for development
 */
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
    return `${timestamp} ${level}: ${message}${metaStr}`;
  })
);

/**
 * Main application logger
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: logFormat,
  defaultMeta: { service: 'peerbridge' },
  transports: [
    // Console — always active
    new winston.transports.Console({
      format: consoleFormat,
    }),

    // All logs → app.log
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'app.log'),
      maxsize: 5 * 1024 * 1024, // 5 MB
      maxFiles: 5,
    }),

    // Errors only → error.log
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      maxsize: 5 * 1024 * 1024,
      maxFiles: 5,
    }),
  ],
  // Prevent unhandled exceptions from crashing silently
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'exceptions.log'),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'rejections.log'),
    }),
  ],
});

/**
 * Audit logger — separate transport for GDPR-style compliance events.
 * Records: login attempts, data access, data modification, data deletion.
 *
 * Usage:
 *   logger.audit('USER_LOGIN', { userId: 123, ip: '1.2.3.4' });
 *   logger.audit('DATA_EXPORT', { userId: 123, tables: ['profile'] });
 *   logger.audit('DATA_DELETE', { userId: 123, reason: 'user request' });
 */
const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.json()
  ),
  defaultMeta: { service: 'peerbridge-audit' },
  transports: [
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'audit.log'),
      maxsize: 10 * 1024 * 1024, // 10 MB
      maxFiles: 10,
    }),
  ],
});

/**
 * Convenience method: write to the audit log.
 *
 * @param {string} action  - Action identifier (e.g., 'USER_LOGIN', 'DATA_DELETE')
 * @param {object} details - Contextual data (userId, ip, resource, etc.)
 */
logger.audit = (action, details = {}) => {
  auditLogger.info(action, {
    action,
    ...details,
    auditTimestamp: new Date().toISOString(),
  });
};

module.exports = logger;
