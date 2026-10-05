const asyncHandler = require('../../utils/asyncHandler');
const { HTTP_STATUS } = require('../../utils/constants');
const matchService = require('./match.service');

const getRecommendations = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;

  const recommendations = await matchService.getRecommendations(userId);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: recommendations,
  });
});

module.exports = { getRecommendations };
