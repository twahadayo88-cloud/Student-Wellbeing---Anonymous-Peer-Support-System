const express = require('express');
const router = express.Router();
const academicController = require('./academic.controller');
const { protect, restrictTo } = require('../../middleware/auth.middleware');

// Public/Student Routes
router.post('/request', protect, restrictTo('student'), academicController.createRequest);
router.get('/requests', protect, academicController.getRequests);
router.get('/requests/my', protect, academicController.getMyRequests);
router.get('/requests/:id', protect, academicController.getRequestById);
router.patch('/requests/:id/status', protect, academicController.updateStatus);
router.delete('/requests/:id', protect, academicController.closeRequest);

router.post('/helper/register', protect, restrictTo('student'), academicController.registerHelper);
router.get('/helpers', protect, restrictTo('student'), academicController.getHelpers);
router.patch('/helper/availability', protect, restrictTo('student'), academicController.updateAvailability);

router.post('/requests/:id/appeal', protect, restrictTo('student'), academicController.submitAppeal);

// Faculty Routes
router.get('/trends', protect, restrictTo('faculty'), academicController.getTrends);

// Admin Routes (handled via standard admin paths usually, but keeping separate for module clarity)
router.get('/admin/queue', protect, restrictTo('admin', 'super_admin'), academicController.getAdminQueue);
router.post('/admin/:id/approve', protect, restrictTo('admin', 'super_admin'), academicController.adminApprove);
router.post('/admin/:id/reject', protect, restrictTo('admin', 'super_admin'), academicController.adminReject);

module.exports = router;
