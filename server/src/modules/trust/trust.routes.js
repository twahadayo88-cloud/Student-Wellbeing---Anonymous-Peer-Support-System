const express = require('express');
const router = express.Router();
const trustController = require('./trust.controller');
const { protect, restrictTo } = require('../../middleware/auth.middleware');

// Public/Student Routes
router.get('/leaderboard', protect, trustController.getLeaderboard);
router.get('/badge', protect, trustController.getMyBadge);
router.get('/history', protect, trustController.getMyHistory);

// Admin Routes
router.get('/history/:userId', protect, restrictTo('admin', 'super_admin'), trustController.getTrustHistoryAdmin);
router.post('/override', protect, restrictTo('admin', 'super_admin'), trustController.overrideScore);
router.delete('/history/:userId', protect, restrictTo('admin', 'super_admin'), trustController.resetTrustHistory);

module.exports = router;
