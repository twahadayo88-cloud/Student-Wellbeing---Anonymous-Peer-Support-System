const express = require('express');
const adminController = require('./admin.controller');
const safetyRoutes = require('../safety/safety.routes');
const { protect, restrictTo } = require('../../middleware/auth.middleware');
const { ROLES } = require('../../utils/constants');

const router = express.Router();

// All admin routes are protected and restricted to admin/super_admin
router.use(protect);
router.use(restrictTo(ROLES.ADMIN, ROLES.SUPER_ADMIN));

/**
 * @route   GET /api/admin/stats
 * @desc    Get platform usage statistics
 */
router.get('/stats', adminController.getStats);

/**
 * @route   GET /api/admin/users
 * @desc    Get all users and profiles
 */
router.get('/users', adminController.getUsers);

/**
 * @route   GET /api/admin/violations
 * @desc    Get all violation history
 */
router.get('/violations', adminController.getViolations);

/**
 * @route   GET /api/admin/audit-logs
 * @desc    Get all audit logs
 */
router.get('/audit-logs', adminController.getAuditLogs);
router.get('/repeat-offenders', adminController.getRepeatOffenders);
router.get('/security/signals', adminController.getSecuritySignals);
router.get('/appeals', adminController.getPendingAppeals);
router.patch('/appeals/:id', adminController.reviewAppeal);
router.get('/moderation/rules', adminController.getModerationRules);
router.post('/moderation/rules', adminController.createModerationRule);
router.patch('/moderation/rules/:id', adminController.updateModerationRule);
router.delete('/moderation/rules/:id', adminController.deleteModerationRule);
router.get('/policy-reviews', adminController.getPolicyReviews);
router.post('/policy-reviews', adminController.recordPolicyReview);
router.get('/repeat-offenders', adminController.getRepeatOffenders);
router.get('/security/signals', adminController.getSecuritySignals);
router.get('/appeals', adminController.getPendingAppeals);
router.patch('/appeals/:id', adminController.reviewAppeal);
router.get('/moderation/rules', adminController.getModerationRules);
router.post('/moderation/rules', adminController.createModerationRule);
router.patch('/moderation/rules/:id', adminController.updateModerationRule);
router.delete('/moderation/rules/:id', adminController.deleteModerationRule);
router.get('/policy-reviews', adminController.getPolicyReviews);
router.post('/policy-reviews', adminController.recordPolicyReview);


/**
 * @route   PATCH /api/admin/users/:id/role
 * @desc    Update user role
 */
router.patch('/users/:id/role', adminController.updateRole);

/**
 * @route   PATCH /api/admin/users/:id/unlock
 * @desc    Unlock a locked or suspended user account
 */
router.patch('/users/:id/unlock', adminController.unlockUser);

// Safety & Moderation Module
router.use('/', safetyRoutes);

module.exports = router;
