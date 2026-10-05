const { Router } = require('express');
const { protect, restrictTo } = require('../../middleware/auth.middleware');
const controller = require('./resources.controller');

const router = Router();
router.use(protect);

router.get('/', restrictTo('student'), controller.listResources);
router.get('/recommendations', restrictTo('student'), controller.getRecommendations);
router.get('/mine', restrictTo('student'), controller.getMine);
router.get('/bookmarks', restrictTo('student'), controller.getBookmarks);
router.post('/', restrictTo('student'), controller.uploadResource, controller.createResource);
router.put('/:id/bookmark', restrictTo('student'), controller.addBookmark);
router.delete('/:id/bookmark', restrictTo('student'), controller.removeBookmark);
router.post('/:id/reviews', restrictTo('student'), controller.addReview);
router.get('/:id/reviews', restrictTo('student'), controller.getReviews);

router.get('/faculty/pending', restrictTo('faculty'), controller.getFacultyQueue);
router.patch('/:id/approval', restrictTo('faculty'), controller.reviewResource);
router.get('/:id/file', restrictTo('student', 'faculty', 'admin', 'super_admin'), controller.downloadResource);

module.exports = router;