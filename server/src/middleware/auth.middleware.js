const jwt = require('jsonwebtoken');
const env = require('../config/env.config');
const AppError = require('../utils/AppError');
const authService = require('../modules/auth/auth.service');

async function protect(req, res, next) {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(AppError.unauthorized('Not authorized to access this route'));
  }

  try {
    // Check if token is blacklisted
    const isBlacklisted = await authService.isTokenBlacklisted(token);
    if (isBlacklisted) {
      return next(AppError.unauthorized('Token is no longer valid. Please login again.'));
    }

    const decoded = jwt.verify(token, env.jwt.secret);
    req.user = decoded;

    // Check if user is blacklisted (suspended)
    const isUserBlacklisted = await authService.isUserBlacklisted(decoded.user_id);
    if (isUserBlacklisted) {
      return next(AppError.unauthorized('Your account has been suspended for 24 hours'));
    }

    next();
  } catch (error) {
    return next(AppError.unauthorized('Token is invalid or expired'));
  }
}

/**
 * restrictTo — role-based authorisation middleware.
 * @param {string[]} roles — allowed roles.
 */
function restrictTo(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
}

module.exports = { protect, restrictTo };
