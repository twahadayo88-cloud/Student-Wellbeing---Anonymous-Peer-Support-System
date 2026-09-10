/**
 * PeerBridge — Global Error Handler Middleware
 * =============================================
 * Catches all errors passed via next(err) and sends a structured JSON response.
 * - Operational errors (AppError): sends message to client
 * - Unexpected errors: logs full detail, sends generic message to client
 * - Production mode: strips stack traces
 */

const logger = require('../utils/logger');

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, _next) => {
  // Default values
  let statusCode = err.statusCode || 500;
  let status = err.status || 'error';
  let message = err.message || 'An unexpected error occurred';

  // Handle specific error types
  if (err.code === 'ER_DUP_ENTRY') {
    statusCode = 409;
    status = 'fail';
    message = 'A record with this information already exists';
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    status = 'fail';
    message = 'Invalid token — please log in again';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    status = 'fail';
    message = 'Token expired — please log in again';
  }

  if (err.type === 'entity.parse.failed') {
    statusCode = 400;
    status = 'fail';
    message = 'Invalid JSON in request body';
  }

  // Log the error
  const logPayload = {
    statusCode,
    message,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    ...(err.details && { details: err.details }),
  };

  if (statusCode >= 500) {
    logger.error('Server Error', { ...logPayload, stack: err.stack });
  } else {
    logger.warn('Client Error', logPayload);
  }

  // Build response
  const response = {
    success: false,
    status,
    message,
    ...(err.code && { code: err.code }),
    ...(err.details && { details: err.details }),
  };

  // Include stack trace in development only
  if (process.env.NODE_ENV !== 'production') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
