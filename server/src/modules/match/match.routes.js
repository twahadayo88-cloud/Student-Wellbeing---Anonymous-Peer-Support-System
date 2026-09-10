const express = require('express');
const { protect } = require('../../middleware/auth.middleware');
const { getRecommendations, getFacultyFallback } = require('./match.controller');

const router = express.Router();

// All match routes require authentication
router.use(protect);

router.get('/recommendations', getRecommendations);
router.get('/faculty', getFacultyFallback);

module.exports = router;
