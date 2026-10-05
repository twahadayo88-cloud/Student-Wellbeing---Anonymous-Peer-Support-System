const express = require('express');
const router = express.Router();
const moodController = require('./mood.controller');
const { protect, restrictTo } = require('../../middleware/auth.middleware');

router.use(protect);

// Personal mood data is student-only.
router.post('/', restrictTo('student'), moodController.submitCheckIn);
router.get('/history', restrictTo('student'), moodController.getHistory);
router.get('/trend', restrictTo('student'), moodController.getTrendSummary);
router.get('/reminder', restrictTo('student'), moodController.getReminderStatus);

// Admin-only route — faculty is explicitly excluded by restrictTo and controller double-check
router.get('/aggregated', restrictTo('admin', 'super_admin'), moodController.getAggregatedTrends);

module.exports = router;

