const { Router } = require('express');
const { protect } = require('../../middleware/auth.middleware');
const { postFeedback } = require('./feedback.controller');

const router = Router();
router.use(protect);

router.post('/', postFeedback);

module.exports = router;
