const { Router } = require('express');
const { protect, restrictTo } = require('../../middleware/auth.middleware');
const controller = require('./notices.controller');

const router = Router();
router.use(protect);

router.get('/', restrictTo('student', 'faculty', 'admin', 'super_admin'), controller.listPosts);
router.get('/mine', restrictTo('student', 'faculty', 'admin', 'super_admin'), controller.getMyPosts);
router.post('/', restrictTo('student', 'faculty', 'admin', 'super_admin'), controller.createPost);
router.get('/faculty/review', restrictTo('faculty'), controller.getFacultyQueue);
router.patch('/faculty/:id/review', restrictTo('faculty'), controller.reviewPost);
router.post('/:id/report', restrictTo('student'), controller.reportPost);
router.put('/:id/reaction', restrictTo('student'), controller.setReaction);
router.put('/:id/save', restrictTo('student'), controller.savePost);
router.post('/:id/extend', restrictTo('student', 'faculty', 'admin', 'super_admin'), controller.extendPost);
router.post('/:id/appeal', restrictTo('student', 'faculty', 'admin', 'super_admin'), controller.appealPost);

module.exports = router;