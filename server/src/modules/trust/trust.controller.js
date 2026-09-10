const trustService = require('./trust.service');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');

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

/**
 * Get User's Score History
 */
const getMyHistory = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const data = await trustService.getTrustHistory(userId);
  res.status(200).json({ success: true, data });
});

/**
 * Admin: Get Detailed Components for a User
 */
const getUserComponents = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { query } = require('../../config/db.config');
  const [rows] = await query('SELECT * FROM trust_score_components WHERE user_id = ?', [userId]);
  
  if (!rows.length) throw new AppError('Components not found for this user', 404);
  
  res.status(200).json({ success: true, data: rows[0] });
});

/**
 * Admin: Manual Score Adjustment (Override)
 */
const overrideScore = asyncHandler(async (req, res) => {
  const { userId, newScore, reason } = req.body;
  const adminId = req.user.user_id;

  if (newScore === undefined || !reason || !userId) {
    throw new AppError('userId, newScore and reason are required', 400);
  }

  const { query } = require('../../config/db.config');
  const [profile] = await query('SELECT trust_score FROM profiles WHERE user_id = ?', [userId]);
  if (!profile.length) throw new AppError('User not found', 404);

  const oldScore = profile[0].trust_score;
  const targetScore = Math.max(0, Math.min(100, parseInt(newScore)));
  const amount = targetScore - oldScore;

  // Update Score
  await query('UPDATE profiles SET trust_score = ? WHERE user_id = ?', [targetScore, userId]);

  // Log History
  await query(`
    INSERT INTO trust_score_history (user_id, admin_id, old_score, new_score, change_amount, change_reason, change_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [userId, adminId, oldScore, targetScore, amount, `Admin Override: ${reason}`, amount >= 0 ? 'increase' : 'decrease']);

  // Update Badge
  await trustService.updateBadgeTier(userId, targetScore);

  // Notify via Socket
  const { getIO } = require('../../config/socket.config');
  const io = getIO();
  if (io) {
    const [userProfile] = await query('SELECT anonymous_id FROM profiles WHERE user_id = ?', [userId]);
    io.to('admin_room').emit('trust:score_updated', {
      user_id: userId,
      anonymous_id: userProfile[0]?.anonymous_id,
      new_score: targetScore,
      reason: reason
    });
  }

  res.status(200).json({ 
    success: true, 
    message: 'Score adjusted successfully',
    data: { oldScore, newScore: targetScore }
  });
});

/**
 * Admin: Get Trust History for a User
 */
const getTrustHistoryAdmin = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const data = await trustService.getTrustHistory(userId);
  res.status(200).json({ success: true, data });
});

/**
 * Admin: Reset Trust History
 */
const resetTrustHistory = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { query } = require('../../config/db.config');
  
  await query('DELETE FROM trust_score_history WHERE user_id = ?', [userId]);
  
  res.status(200).json({ 
    success: true, 
    message: 'Trust history reset successfully'
  });
});

module.exports = {
  getLeaderboard,
  getMyBadge,
  getMyHistory,
  getUserComponents,
  overrideScore,
  getTrustHistoryAdmin,
  resetTrustHistory
};
