/**
 * PeerBridge — HTTP Request Logger Middleware
 * ============================================
 * Logs every incoming request with method, URL, status, and response time.
 * Uses Morgan for HTTP logging, piped into Winston.
 */

const morgan = require('morgan');
const logger = require('../utils/logger');

/**
 * Morgan stream that pipes to Winston.
 */
const morganStream = {
  write: (message) => {
    // Remove trailing newline from Morgan output
    logger.http(message.trim());
  },
};

/**
 * Custom Morgan token format:
 * :method :url :status :response-time ms - :content-length
 */
const requestLogger = morgan(
  ':method :url :status :response-time ms - :res[content-length]',
  {
    stream: morganStream,
    // Skip health-check endpoints to reduce noise
    skip: (req) => req.originalUrl === '/api/health',
  }
);

module.exports = requestLogger;
