const { query } = require('../../config/db.config');
const AppError = require('../../utils/AppError');

async function createChatRequest(senderId, receiverAnonymousId, subjectContext) {
  if (!receiverAnonymousId) {
    throw AppError.badRequest('Receiver ID is missing or empty');
  }

  // 1. Resolve receiverId from anonymousId
  const [receiverRows] = await query('SELECT user_id FROM profiles WHERE anonymous_id = ?', [receiverAnonymousId]);
  if (!receiverRows.length) {
    throw AppError.notFound('Target peer not found: ' + receiverAnonymousId);
  }
  const receiverId = receiverRows[0].user_id;

  if (Number(senderId) === Number(receiverId)) {
    throw AppError.badRequest('You cannot send a chat request to yourself');
  }

  // 2. Check for active pending request
  const [existing] = await query(
    'SELECT id FROM chat_requests WHERE sender_id = ? AND receiver_id = ? AND status = "pending" AND (expires_at > NOW() OR expires_at IS NULL)',
    [senderId, receiverId]
  );
  if (existing.length) {
    throw AppError.conflict('A pending chat request already exists for this peer');
  }

  // 3. Create request with 48h expiry as per hardening requirement
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 48);

  const [result] = await query(
    'INSERT INTO chat_requests (sender_id, receiver_id, subject_context, status, expires_at) VALUES (?, ?, ?, "pending", ?)',
    [senderId, receiverId, subjectContext, expiresAt]
  );

  return result.insertId;
}

async function respondToRequest(userId, requestId, status) {
  if (!['accepted', 'declined'].includes(status)) {
    throw AppError.badRequest('Invalid response status');
  }

  // 1. Fetch request and check ownership (must be receiver)
  const [rows] = await query(
    'SELECT * FROM chat_requests WHERE id = ? AND receiver_id = ? AND status = "pending"',
    [requestId, userId]
  );

  if (!rows.length) {
    throw AppError.notFound('Pending request not found');
  }

  const request = rows[0];

  // 2. Check expiry (automated by cron but checked here for safety)
  if (new Date(request.expires_at) < new Date()) {
    await query('UPDATE chat_requests SET status = "expired" WHERE id = ?', [requestId]);
    throw AppError.badRequest('This chat request has expired');
  }

  // Update status
  await query('UPDATE chat_requests SET status = ? WHERE id = ?', [status, requestId]);

  return request;
}

async function getPendingRequests(userId) {
  // Auto-expire requests if they haven't been already
  await query('UPDATE chat_requests SET status = "expired" WHERE status = "pending" AND expires_at < NOW()');

  // Incoming
  const [incoming] = await query(`
    SELECT cr.id, cr.subject_context, cr.status, cr.created_at, p.anonymous_id as sender_anonymous_id
    FROM chat_requests cr
    JOIN profiles p ON cr.sender_id = p.user_id
    WHERE cr.receiver_id = ? AND cr.status = "pending"
  `, [userId]);

  // Sent
  const [sent] = await query(`
    SELECT cr.id, cr.subject_context, cr.status, cr.created_at, p.anonymous_id as receiver_anonymous_id
    FROM chat_requests cr
    JOIN profiles p ON cr.receiver_id = p.user_id
    WHERE cr.sender_id = ?
  `, [userId]);

  return { incoming, sent };
}

module.exports = {
  createChatRequest,
  respondToRequest,
  getPendingRequests
};
