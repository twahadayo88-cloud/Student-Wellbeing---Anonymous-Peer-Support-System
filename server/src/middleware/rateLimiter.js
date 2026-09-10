/**
 * PeerBridge — Rate Limiter Middleware
 * =====================================
 * Configurable rate limiting using express-rate-limit.
 * Settings loaded from environment variables.
 */

const rateLimit = require('express-rate-limit');
const env = require('../config/env.config');

/**
 * General API rate limiter.
 * Default: 100 requests per 15 minutes per IP.
 */
const apiLimiter = rateLimit({
  windowMs: env.rateLimit.windowMs,
  max: env.rateLimit.max,
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,  // Disable `X-RateLimit-*` headers
  message: {
    success: false,
    status: 'fail',
    message: 'Too many requests from this IP — please try again later',
    code: 'RATE_LIMITED',
  },
});

/**
 * Admin-specific rate limiter.
 * Admin dashboard fires many parallel requests on mount (stats, users, violations,
 * moderation queue, escalations, low-scores, academic queue).
 * 500 requests per 15 minutes per IP — generous but still protective.
 */
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    status: 'fail',
    message: 'Too many admin requests — please try again later',
    code: 'ADMIN_RATE_LIMITED',
  },
});

/**
 * Stricter limiter for auth endpoints (login, register).
 * 20 requests per 15 minutes per IP.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    status: 'fail',
    message: 'Too many authentication attempts — please try again later',
    code: 'AUTH_RATE_LIMITED',
  },
});

module.exports = { apiLimiter, authLimiter, adminLimiter };
