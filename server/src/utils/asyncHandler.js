/**
 * PeerBridge — Async Handler Wrapper
 * ===================================
 * Wraps async route handlers / middleware to automatically
 * catch rejected promises and forward them to Express error handling.
 * Eliminates repetitive try/catch blocks in every controller.
 *
 * Usage:
 *   router.get('/users', asyncHandler(async (req, res) => { ... }));
 */

const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = asyncHandler;
