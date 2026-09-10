/**
 * PeerBridge — Custom Application Error
 * ======================================
 * Extends Error to include HTTP status codes and operational flags.
 * Used with the global error handler to differentiate expected errors
 * (bad input, not found) from unexpected crashes.
 */

class AppError extends Error {
  /**
   * @param {string} message  - Human-readable error message
   * @param {number} statusCode - HTTP status code (default 500)
   * @param {object} [options]
   * @param {boolean} [options.isOperational] - True if error is expected / user-facing
   * @param {string}  [options.code]          - Machine-readable error code
   * @param {object}  [options.details]       - Additional error context
   */
  constructor(message, statusCode = 500, options = {}) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = options.isOperational !== undefined ? options.isOperational : true;
    this.code = options.code || null;
    this.details = options.details || null;

    // Capture stack trace, excluding this constructor
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Factory: 400 Bad Request
   */
  static badRequest(message, details) {
    return new AppError(message, 400, { code: 'BAD_REQUEST', details });
  }

  /**
   * Factory: 401 Unauthorised
   */
  static unauthorized(message = 'Authentication required') {
    return new AppError(message, 401, { code: 'UNAUTHORIZED' });
  }

  /**
   * Factory: 403 Forbidden
   */
  static forbidden(message = 'You do not have permission to perform this action') {
    return new AppError(message, 403, { code: 'FORBIDDEN' });
  }

  /**
   * Factory: 404 Not Found
   */
  static notFound(message = 'Resource not found') {
    return new AppError(message, 404, { code: 'NOT_FOUND' });
  }

  /**
   * Factory: 409 Conflict
   */
  static conflict(message, details) {
    return new AppError(message, 409, { code: 'CONFLICT', details });
  }

  /**
   * Factory: 429 Too Many Requests
   */
  static tooManyRequests(message = 'Too many requests — please try again later') {
    return new AppError(message, 429, { code: 'RATE_LIMITED' });
  }

  /**
   * Factory: 500 Internal Server Error
   */
  static internal(message = 'An unexpected error occurred') {
    return new AppError(message, 500, { code: 'INTERNAL_ERROR', isOperational: false });
  }
}

module.exports = AppError;
