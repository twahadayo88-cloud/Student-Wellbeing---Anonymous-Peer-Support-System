const express = require('express');
const router = express.Router();
const trustController = require('./trust.controller');
const { protect } = require('../../middleware/auth.middleware');

// Public/Student Routes
router.get('/leaderboard', protect, trustController.getLeaderboard);
router.get('/badge', protect, trustController.getMyBadge);

module.exports = router;
