const { Router } = require('express');
const { protect, restrictTo } = require('../../middleware/auth.middleware');
const c = require('./complaint.controller');

const router = Router();
router.use(protect);

// ── Student ────────────────────────────────────────────────
router.post('/', restrictTo('student'), c.submitComplaint);
router.get('/my', restrictTo('student'), c.getMyComplaints);

// ── Faculty ────────────────────────────────────────────────
router.get('/faculty/mine', restrictTo('faculty'), c.getFacultyMine);
router.patch('/:id/review', restrictTo('faculty'), c.reviewLevelOne);

// ── Admin / Super Admin ────────────────────────────────────
router.get('/admin/escalated', restrictTo('admin', 'super_admin'), c.getEscalated);
router.get('/admin/reveal-pending', restrictTo('admin', 'super_admin'), c.getPendingReveals);
router.post('/:id/resolve', restrictTo('admin', 'super_admin'), c.resolveComplaint);
router.get('/:id/audit', restrictTo('admin', 'super_admin'), c.getAuditTrail);
router.post('/:id/reveal-request', restrictTo('admin', 'super_admin'), c.requestReveal);
router.post('/reveal-approve/:recordId', restrictTo('admin', 'super_admin'), c.approveReveal);

module.exports = router;
