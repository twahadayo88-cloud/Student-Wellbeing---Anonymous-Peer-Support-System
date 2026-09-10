const { Router } = require('express');
const { register, login, logout, forgotPassword, verifyOTP, resetPassword } = require('./auth.controller');
const { authLimiter } = require('../../middleware/rateLimiter');

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/verify-otp', authLimiter, verifyOTP);
router.post('/reset-password', authLimiter, resetPassword);

module.exports = router;
