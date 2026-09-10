const express = require('express');
const router = express.Router();
const safetyController = require('./safety.controller');
const { protect, restrictTo } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../utils/constants');

// All safety routes require admin or super_admin
router.use(protect);
router.use(restrictTo(ROLES.ADMIN, ROLES.SUPER_ADMIN));

// Moderation Queue
router.get('/moderation/queue', safetyController.getModerationQueue);
router.post('/moderation/:id/approve', safetyController.approveContent);
router.post('/moderation/:id/reject', safetyController.rejectContent);
router.post('/moderation/:id/escalate', safetyController.escalateContent);

// Safety & Escalations
router.get('/escalations', safetyController.getEscalationHistory);
router.get('/low-scores', safetyController.getLowScoreUsers);
router.post('/identity-reveal/:userId', safetyController.revealIdentity);

module.exports = router;
