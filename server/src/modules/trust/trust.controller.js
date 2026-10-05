const trustService = require('./trust.service');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * Get Monthly Leaderboard
 */
const getLeaderboard = asyncHandler(async (req, res) => {
  const { department } = req.query;
  const data = await trustService.getLeaderboard(department);
  res.status(200).json({ success: true, data });
});

/**
 * Get User's Current Badge Info
 */
const getMyBadge = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const data = await trustService.getUserBadge(userId);
  res.status(200).json({ success: true, data });
});

module.exports = {
  getLeaderboard,
  getMyBadge,
};
