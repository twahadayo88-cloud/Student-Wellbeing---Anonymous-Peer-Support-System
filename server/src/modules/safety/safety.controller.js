const { query } = require('../../config/db.config');
const safetyService = require('./safety.service');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../utils/AppError');

/**
 * Get Moderation Queue
 */
const getModerationQueue = asyncHandler(async (req, res) => {
  const [rows] = await query('SELECT * FROM moderation_queue WHERE status = \'pending\' ORDER BY created_at DESC');
  res.status(200).json({ success: true, data: rows });
});

/**
 * Approve Content
 */
const approveContent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.user_id;

  const [rows] = await query('SELECT * FROM moderation_queue WHERE id = ?', [id]);
  if (!rows.length) throw new AppError('Item not found', 404);

  await query(
    'UPDATE moderation_queue SET status = \'approved\', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
    [adminId, id]
  );

  // If it was a post, we might need to "publish" it or just leave it.
  // Assuming the content remains in its original table and 'moderation_queue' is just a pointer.

  res.status(200).json({ success: true, message: 'Content approved' });
});

/**
 * Reject Content
 */
const rejectContent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.user_id;

  const [rows] = await query('SELECT * FROM moderation_queue WHERE id = ?', [id]);
  if (!rows.length) throw new AppError('Item not found', 404);

  const { user_id, content_type, content_id } = rows[0];

  await query(
    'UPDATE moderation_queue SET status = \'rejected\', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
    [adminId, id]
  );

  // Escalate to level 2 (REMOVAL)
  await safetyService.escalateUser(user_id, 'removal', `Content rejected by admin: ${rows[0].ai_reason}`, content_id);

  res.status(200).json({ success: true, message: 'Content rejected and user penalized' });
});

/**
 * Escalate Content
 */
const escalateContent = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const adminId = req.user.user_id;

  const [rows] = await query('SELECT * FROM moderation_queue WHERE id = ?', [id]);
  if (!rows.length) throw new AppError('Item not found', 404);

  await query(
    'UPDATE moderation_queue SET status = \'escalated\', reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
    [adminId, id]
  );

  // Escalate to level 3 (SUSPENSION)
  await safetyService.escalateUser(rows[0].user_id, 'suspension', 'Admin escalation from moderation queue');

  res.status(200).json({ success: true, message: 'User suspended' });
});

/**
 * Identity Reveal (Requires Dual Approval)
 */
const revealIdentity = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const adminId = req.user.user_id;

  // Check if there is already a pending escalation for identity reveal that needs secondary approval
  const [existing] = await query(
    'SELECT * FROM escalation_records WHERE user_id = ? AND level = \'identity_reveal\' AND secondary_approval_by IS NULL',
    [userId]
  );

  if (existing.length > 0) {
    // This is the second approval
    if (existing[0].actioned_by === adminId) {
      throw new AppError('Secondary approval must be by a different administrator', 400);
    }

    await query(
      'UPDATE escalation_records SET secondary_approval_by = ? WHERE id = ?',
      [adminId, existing[0].id]
    );

    // Get real identity
    const [userRows] = await query('SELECT email FROM users WHERE id = ?', [userId]);
    const realEmail = userRows[0]?.email;

    // Notify student anonymously
    await safetyService.logAuditAction(userId, 'IDENTITY_REVEALED', 'user', userId, 'HIGH', { 
      reason: 'Dual admin approval for identity reveal',
      admin_1: existing[0].actioned_by,
      admin_2: adminId
    });

    res.status(200).json({ 
      success: true, 
      message: 'Identity revealed successfully', 
      data: { email: realEmail } 
    });
  } else {
    // This is the first approval
    await query(
      'INSERT INTO escalation_records (user_id, level, reason, actioned_by) VALUES (?, \'identity_reveal\', \'Pending dual approval for identity reveal\', ?)',
      [userId, adminId]
    );

    res.status(200).json({ success: true, message: 'Identity reveal requested. Awaiting secondary admin approval.' });
  }
});

/**
 * Get Escalation History
 */
const getEscalationHistory = asyncHandler(async (req, res) => {
  const [rows] = await query('SELECT * FROM escalation_records ORDER BY created_at DESC');
  res.status(200).json({ success: true, data: rows });
});

/**
 * Get Low Score Users
 */
const getLowScoreUsers = asyncHandler(async (req, res) => {
  const [rows] = await query('SELECT user_id, anonymous_id, behavior_score FROM profiles WHERE behavior_score < 30 ORDER BY behavior_score ASC');
  res.status(200).json({ success: true, data: rows });
});

module.exports = {
  getModerationQueue,
  approveContent,
  rejectContent,
  escalateContent,
  revealIdentity,
  getEscalationHistory,
  getLowScoreUsers
};
