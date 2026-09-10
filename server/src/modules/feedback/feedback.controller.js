const asyncHandler = require('../../utils/asyncHandler');
const { HTTP_STATUS } = require('../../utils/constants');
const feedbackService = require('./feedback.service');

const postFeedback = asyncHandler(async (req, res) => {
    const fromUserId = req.user.user_id;
    const { to_anonymous_id, rating, request_id } = req.body;

    await feedbackService.submitFeedback(fromUserId, to_anonymous_id, rating, request_id);

    res.status(HTTP_STATUS.CREATED).json({
        success: true,
        message: 'Feedback submitted successfully'
    });
});

module.exports = { postFeedback };
