/**
 * PeerBridge — 404 Not Found Handler
 * ====================================
 * Catches any request that doesn't match a defined route.
 * Must be registered AFTER all route definitions.
 */

const AppError = require('../utils/AppError');

const notFound = (req, _res, next) => {
  next(AppError.notFound(`Route not found: ${req.method} ${req.originalUrl}`));
};

module.exports = notFound;
