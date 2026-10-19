const { query } = require('../../config/db.config');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');

async function createChatRequest(senderId, receiverAnonymousId, subjectContext) {
  if (!receiverAnonymousId) {
    throw AppError.badRequest('Receiver ID is missing or empty');
  }

  const [receiverRows] = await query('SELECT user_id FROM profiles WHERE anonymous_id = ?', [receiverAnonymousId]);
  if (!receiverRows.length) {
    throw AppError.notFound('Target peer not found: ' + receiverAnonymousId);
  }
  const receiverId = receiverRows[0].user_id;

  const [roles] = await query(
    'SELECT id, role FROM users WHERE id IN (?, ?)',
    [senderId, receiverId]
  );
  if (roles.length !== 2 || roles.some(user => user.role !== 'student')) {
    throw AppError.forbidden('Direct chat is available only between students');
  }

  if (Number(senderId) === Number(receiverId)) {
    throw AppError.badRequest('You cannot send a chat request to yourself');
  }

  const [existing] = await query(
    'SELECT id FROM chat_requests WHERE sender_id = ? AND receiver_id = ? AND status = "pending" AND (expires_at > NOW() OR expires_at IS NULL)',
    [senderId, receiverId]
  );
  if (existing.length) {
    throw AppError.conflict('A pending chat request already exists for this peer');
  }

  // ─── Student AI Pipeline Verification (Touchpoint 1: Chat Request) ───
  if (subjectContext && typeof subjectContext === 'string' && subjectContext.trim().length > 0) {
    const safetyService = require('../safety/safety.service');
    const safetyResult = await safetyService.monitorContent(
      subjectContext,
      'chat_request',
      senderId,
      null,
      { useAi: true }
    );
    if (safetyResult.severity === 'HIGH' || safetyResult.severity === 'MEDIUM') {
      logger.warn('Chat request blocked by AI content pipeline', { senderId, reason: safetyResult.reason });
      throw AppError.badRequest(
        `Chat request message contains inappropriate or off-topic content (${safetyResult.reason || 'moderation policy'}). Please revise.`
      );
    }
  }

  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

  const [result] = await query(
    'INSERT INTO chat_requests (sender_id, receiver_id, subject_context, status, expires_at) VALUES (?, ?, ?, "pending", ?)',
    [senderId, receiverId, subjectContext, expiresAt]
  );

  return result.insertId;
}

async function isAcceptedStudentConversation(senderId, receiverId) {
  const [roles] = await query(
    'SELECT role FROM users WHERE id IN (?, ?)',
    [senderId, receiverId]
  );
  if (roles.length !== 2 || roles.some(user => user.role !== 'student')) {
    return false;
  }

  const [requests] = await query(`
    SELECT id
    FROM chat_requests
    WHERE status = 'accepted'
      AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))
    LIMIT 1
  `, [senderId, receiverId, receiverId, senderId]);
  return requests.length > 0;
}

/**
 * Respond to a pending chat request (accepted / declined).
 *
 * Atomicity (Item 4):
 *   All status transitions use conditional WHERE clauses that include
 *   status = 'pending' AND expires_at >= NOW() so the update is a no-op if the
 *   row has already expired or been answered by a concurrent request.
 *
 * Cascade (Item 3 / Item 1):
 *   On decline, _recordExclusion is called first. If it throws (table missing
 *   or constraint failure), the cascade is aborted — the request remains 'open'
 *   but no further re-offer is attempted, preventing blind cascades into bad state.
 */
async function respondToRequest(userId, requestId, status) {
  if (!['accepted', 'declined'].includes(status)) {
    throw AppError.badRequest('Invalid response status');
  }

  const [rows] = await query(
    'SELECT * FROM chat_requests WHERE id = ? AND receiver_id = ? AND status = "pending"',
    [requestId, userId]
  );

  if (!rows.length) {
    throw AppError.notFound('Pending request not found');
  }

  const request = rows[0];

  const [roles] = await query(
    'SELECT role FROM users WHERE id IN (?, ?)',
    [request.sender_id, request.receiver_id]
  );
  if (roles.length !== 2 || roles.some(user => user.role !== 'student')) {
    throw AppError.forbidden('Direct chat is available only between students');
  }

  if (new Date(request.expires_at) < new Date()) {
    await query(
      'UPDATE chat_requests SET status = "expired" WHERE id = ? AND status = "pending"',
      [requestId]
    );
    if (request.academic_request_id) {
      await query(`
        UPDATE academic_requests
        SET status = 'open', matched_helper_id = NULL, matched_at = NULL
        WHERE id = ? AND status = 'matched' AND matched_at IS NULL
      `, [request.academic_request_id]);

      const excludedIds = await _getExcludedHelperIds(request.academic_request_id);
      if (!excludedIds.includes(Number(userId))) excludedIds.push(Number(userId));
      try {
        await _recordExclusion(request.academic_request_id, userId);
      } catch (exclErr) {
        logger.error('respondToRequest(expired): exclusion insert failed — skipping cascade', { error: exclErr.message });
        throw AppError.badRequest('This chat request has expired');
      }
      const academicService = require('../academic/academic.service');
      academicService._offerToNextHelper(request.academic_request_id, excludedIds)
        .catch(err => logger.error('_offerToNextHelper after expiry failed', { error: err.message }));
    }
    throw AppError.badRequest('This chat request has expired');
  }

  if (request.academic_request_id && status === 'accepted') {
    const [matchResult] = await query(`
      UPDATE academic_requests
      SET status = 'in_progress', matched_at = NOW()
      WHERE id = ? AND status = 'matched' AND matched_helper_id = ? AND matched_at IS NULL
    `, [request.academic_request_id, userId]);
    if (!matchResult.affectedRows) throw AppError.conflict('This academic request is no longer available');
  }

  const [responseResult] = await query(
    'UPDATE chat_requests SET status = ? WHERE id = ? AND status = "pending" AND expires_at >= NOW()',
    [status, requestId]
  );
  if (!responseResult.affectedRows) {
    if (request.academic_request_id && status === 'accepted') {
      await query(`
        UPDATE academic_requests
        SET status = 'matched', matched_at = NULL
        WHERE id = ? AND status = 'in_progress' AND matched_helper_id = ?
      `, [request.academic_request_id, userId]);
    }
    throw AppError.conflict('This chat request has already been answered or has expired');
  }

  if (request.academic_request_id && status === 'accepted') {
    await query(
      'UPDATE helper_listings SET current_help_count = current_help_count + 1 WHERE user_id = ?',
      [userId]
    );
  } else if (request.academic_request_id && status === 'declined') {
    await query(`
      UPDATE academic_requests
      SET status = 'open', matched_helper_id = NULL, matched_at = NULL
      WHERE id = ? AND status = 'matched' AND matched_at IS NULL
    `, [request.academic_request_id]);

    try {
      await _recordExclusion(request.academic_request_id, userId);
    } catch (exclErr) {
      logger.error('respondToRequest(declined): exclusion insert failed — skipping cascade', { error: exclErr.message });
      return request;
    }

    const excludedIds = await _getExcludedHelperIds(request.academic_request_id);
    const academicService = require('../academic/academic.service');
    academicService._offerToNextHelper(request.academic_request_id, excludedIds)
      .catch(err => logger.error('_offerToNextHelper after decline failed', { error: err.message }));
  }

  return request;
}

/**
 * Record a helper as excluded (declined or timed out) for an academic request.
 * Throws on failure so the caller can abort the cascade safely.
 */
async function _recordExclusion(academicRequestId, helperUserId) {
  await query(`
    INSERT IGNORE INTO chat_offer_exclusions (academic_request_id, helper_user_id)
    VALUES (?, ?)
  `, [academicRequestId, helperUserId]);
}

/**
 * Return all helper user IDs already excluded for a given academic request.
 * Returns [] on failure (non-fatal for reads).
 */
async function _getExcludedHelperIds(academicRequestId) {
  try {
    const [rows] = await query(
      'SELECT helper_user_id FROM chat_offer_exclusions WHERE academic_request_id = ?',
      [academicRequestId]
    );
    return rows.map(r => Number(r.helper_user_id));
  } catch (err) {
    logger.warn('_getExcludedHelperIds failed (non-fatal)', { error: err.message });
    return [];
  }
}

async function getPendingRequests(userId) {
  await query('UPDATE chat_requests SET status = "expired" WHERE status = "pending" AND expires_at < NOW()');

  const [incoming] = await query(`
    SELECT cr.id, cr.subject_context, cr.status, cr.created_at, cr.expires_at, p.anonymous_id as sender_anonymous_id
    FROM chat_requests cr
    JOIN profiles p ON cr.sender_id = p.user_id
    JOIN users sender_user ON sender_user.id = cr.sender_id AND sender_user.role = 'student'
    JOIN users receiver_user ON receiver_user.id = cr.receiver_id AND receiver_user.role = 'student'
    WHERE cr.receiver_id = ?
  `, [userId]);

  const [sent] = await query(`
    SELECT cr.id, cr.subject_context, cr.status, cr.created_at, p.anonymous_id as receiver_anonymous_id
    FROM chat_requests cr
    JOIN profiles p ON cr.receiver_id = p.user_id
    JOIN users sender_user ON sender_user.id = cr.sender_id AND sender_user.role = 'student'
    JOIN users receiver_user ON receiver_user.id = cr.receiver_id AND receiver_user.role = 'student'
    WHERE cr.sender_id = ?
  `, [userId]);

  return { incoming, sent };
}

module.exports = {
  createChatRequest,
  respondToRequest,
  getPendingRequests,
  isAcceptedStudentConversation,
};
