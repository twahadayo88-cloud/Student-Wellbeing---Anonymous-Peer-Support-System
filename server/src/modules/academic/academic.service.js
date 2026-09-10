const { query } = require('../../config/db.config');
const safetyService = require('../safety/safety.service');
const communicationService = require('../communication/communication.service');
const logger = require('../../utils/logger');
const { getIO } = require('../../config/socket.config');

const REPUTATION_POINTS = {
  helped_successfully: +10,
  received_5_star: +5,
  quick_response: +3,     // responded within 30 minutes
  helped_critical: +15    // helped with critical urgency request
};

/**
 * Academic Support Board Service
 */

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
  
  // Increment counter
  await query(`
    INSERT INTO daily_post_tracker (user_id, post_date, post_count)
    VALUES (?, ?, 1)
    ON DUPLICATE KEY UPDATE post_count = post_count + 1
  `, [userId, today]);
  
  return true;
}

async function moderateAcademicPost(title, description, userId) {
  const combinedText = `${title} ${description}`;
  
  // Use existing safety service
  const result = await safetyService.monitorContent(
    combinedText, 'post', userId, null
  );
  
  if (result.severity === 'LOW') return { status: 'clean' };
  if (result.severity === 'MEDIUM') return { status: 'hold', reason: result.reason };
  if (result.severity === 'HIGH') return { status: 'rejected', reason: result.reason };
}

async function createHelpRequest(userId, data) {
  const { subject, urgency, title, description } = data;
  
  // 1. Check limit
  await checkDailyLimit(userId);
  
  // 2. Moderate
  const mod = await moderateAcademicPost(title, description, userId);
  
  const anonymousId = await communicationService.getAnonymousIdByUserId(userId);
  
  // 3. Insert
  const [res] = await query(`
    INSERT INTO academic_requests 
    (user_id, anonymous_id, subject, urgency, title, description, ai_moderation_status, ai_moderation_reason)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [userId, anonymousId, subject, urgency, title, description, mod.status, mod.reason || null]);

  const requestId = res.insertId;

  // 4. Handle Moderation Flow
  if (mod.status === 'hold') {
    // Add to moderation queue
    await safetyService.addToModerationQueue('academic_request', requestId, `${title}: ${description}`, userId, 'MEDIUM', mod.reason);
  }

  // 5. Notify Faculty if critical
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
  let sql = `
    SELECT ar.*, bt.current_tier as badge_tier 
    FROM academic_requests ar
    LEFT JOIN badge_tiers bt ON ar.user_id = bt.user_id
    WHERE ar.status = 'open' AND ar.ai_moderation_status = 'clean'
  `;
  const params = [];
  
  if (subject) {
    sql += " AND ar.subject = ?";
    params.push(subject);
  }
  
  sql += " ORDER BY ar.created_at DESC";
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

async function getAvailableHelpers(subject, excludeUserId) {
  const [helpers] = await query(`
    SELECT hl.*, p.trust_score, p.anonymous_id
    FROM helper_listings hl
    JOIN profiles p ON hl.user_id = p.user_id
    WHERE JSON_CONTAINS(hl.subjects, ?)
      AND hl.availability = 'available'
      AND hl.current_help_count < hl.max_concurrent_help
      AND hl.user_id != ?
      AND p.trust_score >= 30
    ORDER BY p.trust_score DESC
    LIMIT 10
  `, [JSON.stringify(subject || null), excludeUserId || 0]);
  return helpers;
}

async function initiateHelperChat(requestId, helperId) {
  const [requestRows] = await query('SELECT * FROM academic_requests WHERE id = ?', [requestId]);
  if (!requestRows.length) throw new Error('Request not found');
  const request = requestRows[0];
  const studentId = request.user_id;

  if (request.status !== 'open') {
    throw new Error('This request is no longer open for help.');
  }

  // 1. Create chat request between student and helper
  await query(`
    INSERT INTO chat_requests (sender_id, receiver_id, subject_context, status)
    VALUES (?, ?, ?, 'accepted')
  `, [studentId, helperId, `Academic Help: ${request.title}`]);

  // 2. Update request status to MATCHED
  await query(
    'UPDATE academic_requests SET status = "matched", matched_helper_id = ?, matched_at = NOW() WHERE id = ?',
    [helperId, requestId]
  );

  // 3. Update helper count
  await query('UPDATE helper_listings SET current_help_count = current_help_count + 1 WHERE user_id = ?', [helperId]);

  const studentAnonId = request.anonymous_id;
  const [helperRows] = await query('SELECT anonymous_id FROM profiles WHERE user_id = ?', [helperId]);
  const helperAnonId = helperRows[0]?.anonymous_id;

  // 4. Send Automatic Context Message
  const autoMessage = `Hi! I saw your request: '${request.title}' for ${request.subject}. I can help you with this. Let's get started!`;
  await communicationService.storeMessage(helperId, studentId, autoMessage, false, 'chat_only');

  // Update status to IN_PROGRESS as chat has started
  await query('UPDATE academic_requests SET status = "in_progress" WHERE id = ?', [requestId]);

  // 5. Notify both parties via Socket.io
  const io = getIO();
  if (io) {
    io.to(studentAnonId).emit('academic:chat_initiated', {
      request_id: requestId,
      helper_anonymous_id: helperAnonId,
      message: `A helper has been found for your request '${request.title}'! Chat is now open.`
    });

    // Also send the auto-message via socket for real-time appearance
    io.to(studentAnonId).emit('receive_message', {
      sender_anonymous_id: helperAnonId,
      receiver_anonymous_id: studentAnonId,
      message: autoMessage,
      chat_mode: 'chat_only',
      timestamp: new Date()
    });

    io.to(helperAnonId).emit('academic:help_request_accepted', {
      request_id: requestId,
      subject: request.subject,
      urgency: request.urgency
    });

    // 6. Broadcast update to all board viewers
    io.emit('academic:request_updated', {
      request_id: requestId,
      status: 'in_progress'
    });
  }
}

async function resolveRequest(requestId, rating) {
  const [requestRows] = await query('SELECT * FROM academic_requests WHERE id = ?', [requestId]);
  if (!requestRows.length) throw new Error('Request not found');
  const request = requestRows[0];
  
  if (request.status === 'resolved') return;

  await query(
    'UPDATE academic_requests SET status = "resolved", resolved_at = NOW() WHERE id = ?',
    [requestId]
  );

  const helperId = request.matched_helper_id;
  if (helperId) {
    const trustService = require('../trust/trust.service');
    
    // 1. Trigger Base Event
    await trustService.handleTrustEvent(helperId, 'HELPED_SUCCESSFULLY');

    // 2. Conditional Events based on performance
    if (rating === 5) await trustService.handleTrustEvent(helperId, 'RECEIVED_5_STAR');
    else if (rating === 4) await trustService.handleTrustEvent(helperId, 'RECEIVED_4_STAR');
    
    if (request.urgency === 'critical') {
      await trustService.handleTrustEvent(helperId, 'HELPED_CRITICAL');
    }

    // Check quick response (within 30 mins)
    if (request.matched_at && (new Date() - new Date(request.matched_at) < 30 * 60 * 1000)) {
      await trustService.handleTrustEvent(helperId, 'QUICK_RESPONSE');
    }

    // 3. Update helper listing stats
    await query(
      'UPDATE helper_listings SET total_helped = total_helped + 1, current_help_count = GREATEST(0, current_help_count - 1) WHERE user_id = ?',
      [helperId]
    );

    // Update monthly leaderboard component data
    await query(`
      INSERT INTO trust_score_components (user_id, resolution_count, total_ratings_received, helpfulness_rating)
      VALUES (?, 1, 1, ?)
      ON DUPLICATE KEY UPDATE 
        resolution_count = resolution_count + 1,
        total_ratings_received = total_ratings_received + 1,
        helpfulness_rating = (helpfulness_rating * (total_ratings_received - 1) + VALUES(helpfulness_rating)) / total_ratings_received
    `, [helperId, rating]);

    // Trigger live leaderboard update
    try {
      await trustService.updateMonthlyLeaderboard();
    } catch (leaderboardErr) {
      logger.warn('Failed to update leaderboard after resolve', { error: leaderboardErr.message });
    }
  }
}

async function getFacultyTrends(department) {
  const [trends] = await query(`
    SELECT 
      ar.subject,
      COUNT(*) as total_requests,
      CAST(SUM(CASE WHEN ar.urgency = 'critical' THEN 1 ELSE 0 END) AS SIGNED) as critical_count,
      CAST(SUM(CASE WHEN ar.urgency = 'high' THEN 1 ELSE 0 END) AS SIGNED) as high_count,
      CAST(SUM(CASE WHEN ar.status = 'resolved' THEN 1 ELSE 0 END) AS SIGNED) as resolved_count,
      AVG(TIMESTAMPDIFF(HOUR, ar.created_at, ar.resolved_at)) as avg_resolution_hours
    FROM academic_requests ar
    JOIN profiles p ON ar.user_id = p.user_id
    WHERE p.department = ?
      AND ar.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    GROUP BY ar.subject
    ORDER BY total_requests DESC
  `, [department]);
  return trends;
}

async function submitAppeal(requestId, userId, reason) {
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
  getAvailableHelpers,
  initiateHelperChat,
  resolveRequest,
  getFacultyTrends,
  submitAppeal,
  checkDailyLimit,
  getMyRequests
};
