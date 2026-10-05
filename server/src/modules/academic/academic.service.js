const { query } = require('../../config/db.config');
const safetyService = require('../safety/safety.service');
const communicationService = require('../communication/communication.service');
const logger = require('../../utils/logger');
const { getIO } = require('../../config/socket.config');
const safeParse = require('../../utils/safeParse');

/**
 * Academic Support Board Service
 */

function _configuredScore(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

const MATCH_WEIGHTS = {
  subject:  Math.max(0, _configuredScore('MATCH_WEIGHT_SUBJECT',  40)),
  semester: Math.max(0, _configuredScore('MATCH_WEIGHT_SEMESTER', 25)),
  trust:    Math.max(0, _configuredScore('MATCH_WEIGHT_TRUST',    20)),
  activity: Math.max(0, _configuredScore('MATCH_WEIGHT_ACTIVITY', 15)),
};

function _minTrustScore() {
  return Math.max(0, Math.min(100, _configuredScore('MATCH_MIN_TRUST_SCORE', 30)));
}

function _maxOfferAttempts() {
  return Math.max(1, Math.round(_configuredScore('MATCH_MAX_OFFER_ATTEMPTS', 5)));
}

function _feedbackCap() {
  return Math.max(0, _configuredScore('MATCH_FEEDBACK_MAX', 5));
}

async function checkDailyLimit(userId) {
  const today = new Date().toISOString().split('T')[0];
  const [rows] = await query(
    'SELECT post_count FROM daily_post_tracker WHERE user_id = ? AND post_date = ?',
    [userId, today]
  );
  
  const currentCount = rows.length ? rows[0].post_count : 0;
  if (currentCount >= 5) {
    throw new Error('Daily posting limit reached. Try again tomorrow.');
  }
  
  await query(`
    INSERT INTO daily_post_tracker (user_id, post_date, post_count)
    VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE post_count = post_count + 1
  `, [userId, today]);
  
  return true;
}

async function moderateAcademicPost(title, description, userId) {
  const combinedText = `${title} ${description}`;
  
  const result = await safetyService.monitorContent(
    combinedText, 'post', userId, null
  );
  
  if (result.severity === 'LOW') return { status: 'clean' };
  if (result.severity === 'MEDIUM') return { status: 'hold', reason: result.reason };
  if (result.severity === 'HIGH') return { status: 'rejected', reason: result.reason };
  return { status: 'hold', reason: 'Content review required' };
}

async function createHelpRequest(userId, data) {
  const { subject, urgency, title, description } = data;
  
  await checkDailyLimit(userId);
  
  const mod = await moderateAcademicPost(title, description, userId);
  
  const anonymousId = await communicationService.getAnonymousIdByUserId(userId);
  
  const [res] = await query(`
    INSERT INTO academic_requests 
    (user_id, anonymous_id, subject, urgency, title, description, ai_moderation_status, ai_moderation_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [userId, anonymousId, subject, urgency, title, description, mod.status, mod.reason || null]);

  const requestId = res.insertId;

  if (mod.status === 'hold') {
    await safetyService.addToModerationQueue('academic_request', requestId, `${title}: ${description}`, userId, 'MEDIUM', mod.reason);
  }

  if (urgency === 'critical' && mod.status === 'clean') {
    const io = getIO();
    if (io) {
      io.to('admin_room').emit('academic:critical_request', {
        id: requestId,
        subject,
        anonymous_id: anonymousId
      });
    }
  }

  return { id: requestId, moderation: mod };
}

async function getOpenRequests(subject = null) {
  await query('UPDATE chat_requests SET status = "expired" WHERE status = "pending" AND expires_at < NOW() AND academic_request_id IS NOT NULL');
  await query(`
    UPDATE academic_requests ar
    JOIN chat_requests cr ON cr.academic_request_id = ar.id
    SET ar.status = 'open', ar.matched_helper_id = NULL, ar.matched_at = NULL
    WHERE cr.status = 'expired' AND ar.status = 'matched' AND ar.matched_at IS NULL
  `);

  let sql = `
    SELECT ar.*, bt.current_tier as badge_tier 
    FROM academic_requests ar
    LEFT JOIN badge_tiers bt ON ar.user_id = bt.user_id
    WHERE ar.status = 'open' AND ar.ai_moderation_status = 'clean'
  `;
  const params = [];
  
  if (subject) {
    sql += ' AND ar.subject = ?';
    params.push(subject);
  }
  
  sql += ' ORDER BY ar.created_at DESC';
  const [rows] = await query(sql, params);
  return rows;
}

async function registerAsHelper(userId, subjects) {
  const anonymousId = await communicationService.getAnonymousIdByUserId(userId);
  await query(`
    INSERT INTO helper_listings (user_id, anonymous_id, subjects)
    VALUES (?, ?, ?)
    ON DUPLICATE KEY UPDATE subjects = ?, updated_at = NOW(), availability = 'available'
  `, [userId, anonymousId, JSON.stringify(subjects), JSON.stringify(subjects)]);
}

async function getHelperListing(userId) {
  const [rows] = await query(
    'SELECT id, subjects, availability, max_concurrent_help, current_help_count FROM helper_listings WHERE user_id = ?',
    [userId]
  );
  return rows;
}

/**
 * Get all academic help requests posted by a specific user.
 * @param {number} userId
 */
async function getMyRequests(userId) {
  const [rows] = await query(`
    SELECT ar.*, bt.current_tier as badge_tier
    FROM academic_requests ar
    LEFT JOIN badge_tiers bt ON ar.user_id = bt.user_id
    WHERE ar.user_id = ? 
    ORDER BY ar.created_at DESC
  `, [userId]);
  return rows;
}

/**
 * Prompt 1, Task 3 — Faculty expertise tags are NOT used here.
 * This engine is student-to-student only. The JOIN enforces `u.role = 'student'`,
 * ensuring no faculty user can appear as a candidate helper regardless of their profile tags.
 * Trust-score threshold of 30 is applied live from the `profiles` table (not cached/fallback).
 */
async function getAvailableHelpers(subject, excludeUserId) {
  const minTrustScore = _minTrustScore();
  const [helpers] = await query(`
    SELECT hl.*, p.anonymous_id
    FROM helper_listings hl
    JOIN profiles p ON hl.user_id = p.user_id
    JOIN users u ON u.id = hl.user_id AND u.role = 'student'
    WHERE JSON_CONTAINS(hl.subjects, ?)
      AND hl.availability = 'available'
      AND hl.current_help_count < hl.max_concurrent_help
      AND hl.user_id != ?
      AND p.trust_score >= ?
    ORDER BY p.trust_score DESC
    LIMIT 10
  `, [JSON.stringify(subject || null), excludeUserId || 0, minTrustScore]);
  return helpers;
}

/**
 * Score a single helper candidate against the requester's profile using the same
 * weighted formula as match.service.js: subject overlap, semester proximity,
 * live trust score, and recent activity.
 *
 * A capped helper_feedback adjustment (MATCH_FEEDBACK_MAX) is read from the
 * helper_feedback table and added AFTER the base score — it is never written to
 * trust_score_components.
 *
 * @param {object} requester  - { subjects: string[], semester: string|number }
 * @param {object} candidate  - DB row from the candidate query
 * @param {number} feedbackAdj - per-helper feedback adjustment, already capped
 * @returns {number} combined score [0, 1+cap]
 */
function _scoreCandidate(requester, candidate, feedbackAdj) {
  const weightTotal = Object.values(MATCH_WEIGHTS).reduce((t, w) => t + Math.max(0, w), 0) || 1;

  const mySubjects = requester.subjects;
  const cSubjects  = safeParse(candidate.subjects);

  const subjectScore = mySubjects.length
    ? Math.min(mySubjects.filter(s => cSubjects.includes(s)).length / mySubjects.length, 1)
    : 0;

  const mySem   = Number(requester.semester);
  const candSem = Number(candidate.semester);
  const semesterGap = Number.isFinite(mySem) && Number.isFinite(candSem)
    ? Math.abs(mySem - candSem)
    : (requester.semester && candidate.semester && requester.semester === candidate.semester ? 0 : Infinity);
  const semesterScore = semesterGap === 0 ? 1
    : semesterGap === 1 ? 0.75
      : semesterGap === 2 ? 0.5
        : semesterGap === 3 ? 0.25 : 0;

  const trustScore = Math.max(0, Math.min(100, Number(candidate.trust_score) || 0)) / 100;

  const activityDate = candidate.recent_activity_at ? new Date(candidate.recent_activity_at) : null;
  let activityScore = 0;
  if (activityDate && !Number.isNaN(activityDate.getTime())) {
    const ageInDays = (Date.now() - activityDate.getTime()) / (24 * 60 * 60 * 1000);
    if (ageInDays <= 1) activityScore = 1;
    else if (ageInDays <= 7) activityScore = 0.8;
    else if (ageInDays <= 30) activityScore = 0.5;
    else if (ageInDays <= 90) activityScore = 0.2;
  }

  const baseScore = (
    subjectScore  * Math.max(0, MATCH_WEIGHTS.subject)  +
    semesterScore * Math.max(0, MATCH_WEIGHTS.semester)  +
    trustScore    * Math.max(0, MATCH_WEIGHTS.trust)     +
    activityScore * Math.max(0, MATCH_WEIGHTS.activity)
  ) / weightTotal;

  return baseScore + feedbackAdj;
}

/**
 * Build per-helper feedback adjustments from the helper_feedback table.
 * Returns a Map<userId, cappedAdjustment>.
 * The adjustment is: (avg_rating - 3) * 2, clamped to [-cap, +cap].
 * cap = MATCH_FEEDBACK_MAX env var (default 5).
 *
 * This is read-only — nothing is written to trust_score_components.
 *
 * @param {number[]} helperUserIds
 * @returns {Promise<Map<number,number>>}
 */
async function _buildFeedbackAdjustments(helperUserIds) {
  const cap = _feedbackCap();
  const result = new Map();
  if (!helperUserIds.length) return result;

  try {
    const placeholders = helperUserIds.map(() => '?').join(',');
    const [rows] = await query(
      `SELECT helper_user_id, AVG(rating) AS avg_rating
       FROM helper_feedback
       WHERE helper_user_id IN (${placeholders})
       GROUP BY helper_user_id`,
      helperUserIds
    );
    for (const row of rows) {
      const raw = (Number(row.avg_rating) - 3) * 2;
      result.set(Number(row.helper_user_id), Math.max(-cap, Math.min(cap, raw)));
    }
  } catch (err) {
    logger.warn('_buildFeedbackAdjustments: helper_feedback query failed (non-fatal)', { error: err.message });
  }
  return result;
}

/**
 * Module 1 — Cascade to next-best helper after decline or expiry.
 *
 * Scoring: identical weighted formula as match.service.js (subject, semester,
 * trust, activity). A helper_feedback adjustment, capped to MATCH_FEEDBACK_MAX,
 * is added on top as a separate read-only signal (never written to trust_score_components).
 *
 * Safety:
 *  - If chat_offer_exclusions insert fails → logs error, aborts cascade, leaves request Open.
 *  - If total offers for this request >= MATCH_MAX_OFFER_ATTEMPTS → leaves request Open.
 *  - Only reverts to 'open' when no candidate remains or a limit is reached.
 *
 * @param {number}   requestId      - academic_requests.id
 * @param {number[]} excludeUserIds - helpers already tried (declined / timed out)
 */
async function _offerToNextHelper(requestId, excludeUserIds = []) {
  const [requestRows] = await query('SELECT * FROM academic_requests WHERE id = ?', [requestId]);
  if (!requestRows.length) return;
  const request = requestRows[0];

  if (request.status !== 'open') return;

  const maxAttempts = _maxOfferAttempts();
  const attemptCount = excludeUserIds.length;
  if (attemptCount >= maxAttempts) {
    logger.info(`_offerToNextHelper: requestId=${requestId} reached max attempts (${maxAttempts}), leaving open`);
    const io = getIO();
    if (io) io.emit('academic:request_updated', { request_id: requestId, status: 'open' });
    return;
  }

  const minTrustScore = _minTrustScore();
  const excluded = [request.user_id, ...excludeUserIds].filter(id => Number.isFinite(Number(id)));
  const placeholders = excluded.map(() => '?').join(',');

  const [requesterRows] = await query(
    'SELECT subjects, semester FROM profiles WHERE user_id = ?',
    [request.user_id]
  );
  const requester = {
    subjects: safeParse(requesterRows[0] ? requesterRows[0].subjects : null),
    semester:  requesterRows[0] ? requesterRows[0].semester : null,
  };

  const [candidates] = await query(`
    SELECT hl.user_id, hl.subjects, p.anonymous_id, p.trust_score, p.semester,
      GREATEST(
        COALESCE(p.updated_at, '1970-01-01'),
        COALESCE((
          SELECT MAX(cm.created_at)
          FROM chat_messages cm
          WHERE cm.sender_id = p.user_id OR cm.receiver_id = p.user_id
        ), '1970-01-01')
      ) AS recent_activity_at
    FROM helper_listings hl
    JOIN profiles p ON p.user_id = hl.user_id
    JOIN users u ON u.id = hl.user_id AND u.role = 'student'
    WHERE JSON_CONTAINS(hl.subjects, ?)
      AND hl.availability = 'available'
      AND hl.current_help_count < hl.max_concurrent_help
      AND hl.user_id NOT IN (${placeholders})
      AND p.trust_score >= ?
  `, [JSON.stringify(request.subject), ...excluded, minTrustScore]);

  if (!candidates.length) {
    logger.info(`_offerToNextHelper: no candidates for requestId=${requestId}, leaving open`);
    const io = getIO();
    if (io) io.emit('academic:request_updated', { request_id: requestId, status: 'open' });
    return;
  }

  const feedbackMap = await _buildFeedbackAdjustments(candidates.map(c => c.user_id));

  const scored = candidates.map(c => ({
    ...c,
    _score: _scoreCandidate(requester, c, feedbackMap.get(c.user_id) || 0),
  }));
  scored.sort((a, b) => b._score - a._score);
  const nextHelper = scored[0];

  const [reserveResult] = await query(`
    UPDATE academic_requests
    SET status = 'matched', matched_helper_id = ?, matched_at = NULL
    WHERE id = ? AND status = 'open'
  `, [nextHelper.user_id, requestId]);
  if (!reserveResult.affectedRows) return;

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  let chatRequestId;
  try {
    const [chatResult] = await query(`
      INSERT INTO chat_requests (sender_id, receiver_id, subject_context, academic_request_id, status, expires_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `, [request.user_id, nextHelper.user_id, `Academic Help: ${request.title}`, requestId, expiresAt]);
    chatRequestId = chatResult.insertId;
  } catch (insertErr) {
    await query(`
      UPDATE academic_requests
      SET status = 'open', matched_helper_id = NULL, matched_at = NULL
      WHERE id = ? AND status = 'matched' AND matched_at IS NULL
    `, [requestId]);
    logger.error('_offerToNextHelper: chat_request insert failed, reverted to open', { error: insertErr.message });
    return;
  }

  try {
    await query(`
      INSERT IGNORE INTO chat_offer_exclusions (academic_request_id, helper_user_id)
      VALUES (?, ?)
    `, [requestId, nextHelper.user_id]);
  } catch (exclErr) {
    logger.error('_offerToNextHelper: chat_offer_exclusions insert failed — aborting cascade, reverting to open', { error: exclErr.message });
    await query('UPDATE chat_requests SET status = "expired" WHERE id = ? AND status = "pending"', [chatRequestId]);
    await query(`
      UPDATE academic_requests
      SET status = 'open', matched_helper_id = NULL, matched_at = NULL
      WHERE id = ? AND status = 'matched' AND matched_at IS NULL
    `, [requestId]);
    return;
  }

  const io = getIO();
  if (io) {
    io.to(nextHelper.anonymous_id).emit('chat_request:new', {
      id: chatRequestId,
      academic_request_id: requestId,
      sender_anonymous_id: request.anonymous_id,
      subject_context: `Academic Help: ${request.title}`,
      expires_at: expiresAt
    });
    io.emit('academic:request_updated', { request_id: requestId, status: 'matched' });
  }
  logger.info(`_offerToNextHelper: offered requestId=${requestId} to helperId=${nextHelper.user_id} (attempt ${attemptCount + 1}/${maxAttempts})`);
}

async function initiateHelperChat(requestId, helperId) {
  const [requestRows] = await query('SELECT * FROM academic_requests WHERE id = ?', [requestId]);
  if (!requestRows.length) throw new Error('Request not found');
  const request = requestRows[0];
  const studentId = request.user_id;

  const [roles] = await query(
    'SELECT id, role FROM users WHERE id IN (?, ?)',
    [studentId, helperId]
  );
  if (roles.length !== 2 || roles.some(user => user.role !== 'student')) {
    throw new Error('Academic chat is available only between students');
  }

  if (request.status !== 'open') {
    throw new Error('This request is no longer open for help.');
  }

  const minTrustScore = _minTrustScore();
  const [helperRows] = await query(`
    SELECT p.anonymous_id
    FROM helper_listings hl
    JOIN profiles p ON p.user_id = hl.user_id
    WHERE hl.user_id = ? AND hl.availability = 'available'
      AND hl.current_help_count < hl.max_concurrent_help
      AND JSON_CONTAINS(hl.subjects, ?)
      AND p.trust_score >= ?
  `, [helperId, JSON.stringify(request.subject), minTrustScore]);
  if (!helperRows.length) throw new Error('Helper is unavailable or does not meet the live trust threshold.');

  const [pending] = await query(`
    SELECT id FROM chat_requests
    WHERE academic_request_id = ? AND status = 'pending' AND expires_at > NOW()
  `, [requestId]);
  if (pending.length) throw new Error('This request is already awaiting a helper response.');

  const [reserveResult] = await query(`
    UPDATE academic_requests
    SET status = 'matched', matched_helper_id = ?, matched_at = NULL
    WHERE id = ? AND status = 'open'
  `, [helperId, requestId]);
  if (!reserveResult.affectedRows) throw new Error('This request is no longer open for help.');

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  try {
    const [chatResult] = await query(`
      INSERT INTO chat_requests (sender_id, receiver_id, subject_context, academic_request_id, status, expires_at)
      VALUES (?, ?, ?, ?, 'pending', ?)
    `, [studentId, helperId, `Academic Help: ${request.title}`, requestId, expiresAt]);

    const io = getIO();
    if (io) {
      io.to(helperRows[0].anonymous_id).emit('chat_request:new', {
        id: chatResult.insertId,
        academic_request_id: requestId,
        sender_anonymous_id: request.anonymous_id,
        subject_context: `Academic Help: ${request.title}`,
        expires_at: expiresAt
      });
      io.emit('academic:request_updated', { request_id: requestId, status: 'matched' });
    }
    return chatResult.insertId;
  } catch (error) {
    await query(`
      UPDATE academic_requests
      SET status = 'open', matched_helper_id = NULL, matched_at = NULL
      WHERE id = ? AND status = 'matched' AND matched_at IS NULL
    `, [requestId]);
    throw error;
  }
}

/**
 * Module 1 — Feedback loop.
 * Stores one helper_feedback row per resolved request (idempotent upsert).
 * Does NOT write to trust_score_components — the adjustment is read at match
 * time from helper_feedback and applied as a capped separate signal.
 */
async function storeHelperFeedback(requestId, helperId, rating, requesterId) {
  const numRating = Number(rating);
  if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
    throw new Error('Rating must be an integer from 1 to 5');
  }

  await query(`
    INSERT INTO helper_feedback (request_id, helper_user_id, requester_user_id, rating)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE rating = VALUES(rating), updated_at = NOW()
  `, [requestId, helperId, requesterId, numRating]);

  logger.info(`helper_feedback stored: requestId=${requestId} helperId=${helperId} rating=${numRating}`);
}

async function resolveRequest(requestId, rating, actorId) {
  const [requestRows] = await query('SELECT * FROM academic_requests WHERE id = ?', [requestId]);
  if (!requestRows.length) throw new Error('Request not found');
  const request = requestRows[0];

  if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
    throw new Error('Rating must be an integer from 1 to 5');
  }
  if (Number(request.user_id) !== Number(actorId)) {
    throw new Error('Only the requester can resolve and rate this request');
  }
  
  if (request.status === 'resolved') return;
  if (!['matched', 'in_progress'].includes(request.status)) {
    throw new Error('Only matched or in-progress requests can be resolved');
  }

  await query(
    'UPDATE academic_requests SET status = "resolved", resolved_at = NOW() WHERE id = ?',
    [requestId]
  );

  const helperId = request.matched_helper_id;
  if (helperId) {
    const trustService = require('../trust/trust.service');
    
    await trustService.handleTrustEvent(helperId, 'HELPED_SUCCESSFULLY');

    if (rating === 5) await trustService.handleTrustEvent(helperId, 'RECEIVED_5_STAR');
    else if (rating === 4) await trustService.handleTrustEvent(helperId, 'RECEIVED_4_STAR');
    
    if (request.urgency === 'critical') {
      await trustService.handleTrustEvent(helperId, 'HELPED_CRITICAL');
    }

    if (request.matched_at && (new Date() - new Date(request.matched_at) < 30 * 60 * 1000)) {
      await trustService.handleTrustEvent(helperId, 'QUICK_RESPONSE');
    }

    await query(
      'UPDATE helper_listings SET total_helped = total_helped + 1, current_help_count = GREATEST(0, current_help_count - 1) WHERE user_id = ?',
      [helperId]
    );

    await query(`
      INSERT INTO trust_score_components (user_id, resolution_count, total_ratings_received, helpfulness_rating)
      VALUES (?, 1, 1, ?)
      ON DUPLICATE KEY UPDATE
        resolution_count = resolution_count + 1,
        helpfulness_rating = (helpfulness_rating * total_ratings_received + VALUES(helpfulness_rating)) / (total_ratings_received + 1),
        total_ratings_received = total_ratings_received + 1
    `, [helperId, Number(rating)]);

    try {
      await storeHelperFeedback(requestId, helperId, rating, actorId);
    } catch (fbErr) {
      logger.warn('storeHelperFeedback failed (non-fatal)', { error: fbErr.message });
    }

    await trustService.recalculateTrustScore(helperId);

    try {
      await trustService.updateMonthlyLeaderboard();
    } catch (leaderboardErr) {
      logger.warn('Failed to update leaderboard after resolve', { error: leaderboardErr.message });
    }
  }
}

async function updateRequestStatus(requestId, actorId, status) {
  const allowedStatuses = ['open', 'matched', 'in_progress', 'closed'];
  if (!allowedStatuses.includes(status)) {
    throw new Error('Invalid academic request status');
  }

  const [rows] = await query(
    'SELECT user_id, matched_helper_id, status FROM academic_requests WHERE id = ?',
    [requestId]
  );
  if (!rows.length) throw new Error('Request not found');

  const request = rows[0];
  const isOwner = Number(request.user_id) === Number(actorId);
  const isHelper = Number(request.matched_helper_id) === Number(actorId);
  if (!isOwner && !isHelper) throw new Error('You cannot update this request');

  if (status === 'open' && !isOwner) throw new Error('Only the requester can reopen a request');
  if (status === 'matched' && !isHelper) throw new Error('Only the matched helper can set matched status');
  if (status === 'in_progress' && !isHelper) throw new Error('Only the matched helper can start a request');

  await query(
    'UPDATE academic_requests SET status = ?, closed_at = CASE WHEN ? = "closed" THEN NOW() ELSE closed_at END WHERE id = ?',
    [status, status, requestId]
  );
}

async function closeRequest(requestId, actorId) {
  const [rows] = await query(
    'SELECT user_id, matched_helper_id FROM academic_requests WHERE id = ?',
    [requestId]
  );
  if (!rows.length) throw new Error('Request not found');
  const request = rows[0];
  if (Number(request.user_id) !== Number(actorId) && Number(request.matched_helper_id) !== Number(actorId)) {
    throw new Error('You cannot close this request');
  }
  await query('UPDATE academic_requests SET status = "closed", closed_at = NOW() WHERE id = ?', [requestId]);
}

/**
 * Prompt 1, Task 4 — 24h Unmatched Signal (read-only).
 * `unmatched_24h_count` counts requests that are still 'open' with no match after 24 hours.
 * This is a passive read-only aggregate surfaced on the faculty trend dashboard.
 * No chat action, contact link, or notification is attached to this signal.
 * Faculty can observe the pattern; they cannot initiate any conversation from this data.
 */
async function getFacultyTrends(department) {
  await query('UPDATE chat_requests SET status = "expired" WHERE status = "pending" AND expires_at < NOW() AND academic_request_id IS NOT NULL');
  await query(`
    UPDATE academic_requests ar
    JOIN chat_requests cr ON cr.academic_request_id = ar.id
    SET ar.status = 'open', ar.matched_helper_id = NULL, ar.matched_at = NULL
    WHERE cr.status = 'expired' AND ar.status = 'matched' AND ar.matched_at IS NULL
  `);

  const [trends] = await query(`
    SELECT 
      ar.subject,
      COUNT(*) as total_requests,
      CAST(SUM(CASE WHEN ar.urgency = 'critical' THEN 1 ELSE 0 END) AS SIGNED) as critical_count,
      CAST(SUM(CASE WHEN ar.urgency = 'high' THEN 1 ELSE 0 END) AS SIGNED) as high_count,
      CAST(SUM(CASE WHEN ar.status = 'resolved' THEN 1 ELSE 0 END) AS SIGNED) as resolved_count,
      CAST(SUM(CASE WHEN ar.status = 'open' AND ar.ai_moderation_status = 'clean' AND ar.created_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR) THEN 1 ELSE 0 END) AS SIGNED) as unmatched_24h_count,
      AVG(TIMESTAMPDIFF(HOUR, ar.created_at, ar.resolved_at)) as avg_resolution_hours
    FROM academic_requests ar
    JOIN profiles p ON ar.user_id = p.user_id
    WHERE p.department = ?
      AND ar.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY ar.subject
    ORDER BY total_requests DESC
  `, [department]);
  const [unmatchedRequests] = await query(`
    SELECT ar.subject, ar.urgency, ar.created_at,
      TIMESTAMPDIFF(HOUR, ar.created_at, NOW()) AS hours_waiting
    FROM academic_requests ar
    JOIN profiles p ON ar.user_id = p.user_id
    WHERE p.department = ? AND ar.status = 'open' AND ar.ai_moderation_status = 'clean'
      AND ar.created_at <= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ORDER BY ar.created_at ASC
  `, [department]);
  return { trends, unmatched_requests: unmatchedRequests };
}

async function submitAppeal(requestId, userId, reason) {
  const [requests] = await query(
    'SELECT user_id, ai_moderation_status FROM academic_requests WHERE id = ?',
    [requestId]
  );
  if (!requests.length) throw new Error('Request not found');
  if (Number(requests[0].user_id) !== Number(userId)) {
    throw new Error('Only the requester can appeal this request');
  }
  if (requests[0].ai_moderation_status !== 'hold' && requests[0].ai_moderation_status !== 'rejected') {
    throw new Error('Only moderated requests can be appealed');
  }
  await query(`
    INSERT INTO request_appeals (request_id, user_id, appeal_reason)
    VALUES (?, ?, ?)
  `, [requestId, userId, reason]);

  await query(
    'UPDATE academic_requests SET appeal_status = "pending" WHERE id = ?',
    [requestId]
  );

  const io = getIO();
  if (io) {
    io.to('admin_room').emit('academic:appeal_submitted', {
      request_id: requestId,
      reason: reason
    });
  }
}

module.exports = {
  createHelpRequest,
  getOpenRequests,
  registerAsHelper,
  getHelperListing,
  getAvailableHelpers,
  initiateHelperChat,
  resolveRequest,
  storeHelperFeedback,
  updateRequestStatus,
  closeRequest,
  getFacultyTrends,
  submitAppeal,
  checkDailyLimit,
  getMyRequests,
  _offerToNextHelper,
};
