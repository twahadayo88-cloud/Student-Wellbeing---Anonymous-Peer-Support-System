const { query } = require('../../config/db.config');
const logger = require('../../utils/logger');
const contentSafety = require('../../services/contentSafety.service');


// ============================================================
// 2. SCORE CHANGES
// ============================================================

const SCORE_CHANGES = {
  helpful_response: 5,
  resolved_chat: 3,
  warning_received: -2,
  content_removed: -4,
  suspension: -6,
};


// ============================================================
// 5. UNIFIED MONITORING PIPELINE
// ============================================================

async function monitorContent(
  content,
  contentType,
  userId,
  contentId = null,
  options = { useAi: false }
) {

  const safetyResult = await contentSafety.analyzeContent(content, options);
  const severity = safetyResult.severity.toUpperCase();
  const reason = safetyResult.isFlagged
    ? `Content flagged: ${safetyResult.matchedTerms.join(', ') || 'local toxicity model'}`
    : null;
  const source = safetyResult.matchedTerms.some(term => term.startsWith('ai_flag_'))
    ? 'sklearn'
    : safetyResult.isFlagged
      ? 'keyword'
      : 'clean';


  // ==========================================================
  // ACTION BASED ON SEVERITY
  // ==========================================================

  if (severity === 'HIGH') {

    await addToModerationQueue(
      contentType,
      contentId,
      content,
      userId,
      'HIGH',
      reason
    );

    if (contentType === 'message') {

      // For live chat:
      // warn the user instead of immediate removal/suspension.
      await escalateUser(
        userId,
        'warning',
        reason,
        contentId
      );

    } else {

      // For posts, uploads, profiles:
      // remove the content.
      await escalateUser(
        userId,
        'removal',
        reason,
        contentId
      );
    }


  } else if (
    severity === 'MEDIUM' &&
    (contentType !== 'message' || contentId)
  ) {

    await addToModerationQueue(
      contentType,
      contentId,
      content,
      userId,
      'MEDIUM',
      reason
    );
  }


  if (severity !== 'LOW') {
    await logAuditAction(
      userId,
      'CONTENT_FLAGGED',
      contentType,
      contentId,
      severity,
      { reason, source }
    );
  }


  return {
    isFlagged: safetyResult.isFlagged,
    severity,
    reason,
    source,
    matchedTerms: safetyResult.matchedTerms,
    sentimentScore: safetyResult.sentimentScore
  };
}


// ============================================================
// 6. ESCALATION SYSTEM
// ============================================================

async function escalateUser(
  userId,
  level,
  reason,
  contentId = null,
  skipScoreUpdate = false
) {

  const [userRows] = await query(
    'SELECT anonymous_id FROM profiles WHERE user_id = ?',
    [userId]
  );

  const anonId = userRows[0]?.anonymous_id;


  // 1. Create Escalation Record

  await query(
    'INSERT INTO escalation_records (user_id, anonymous_id, level, reason, content_ref) VALUES (?, ?, ?, ?, ?)',
    [
      userId,
      anonId || null,
      level,
      reason,
      contentId ? String(contentId) : null
    ]
  );


  // 2. Perform Action

  let scoreChange = 0;

  const trustService =
    require('../trust/trust.service');


  if (level === 'warning') {

    scoreChange =
      SCORE_CHANGES.warning_received;

    await notifyUser(
      userId,
      'SAFETY_WARNING',
      `Warning: ${reason}`
    );

    await trustService.handleTrustEvent(
      userId,
      'WARNING_RECEIVED'
    );


  } else if (level === 'removal') {

    scoreChange =
      SCORE_CHANGES.content_removed;

    await notifyUser(
      userId,
      'CONTENT_REMOVED',
      `Your content was removed due to: ${reason}`
    );

    await trustService.handleTrustEvent(
      userId,
      'CONTENT_REMOVED'
    );


  } else if (level === 'suspension') {

    scoreChange =
      SCORE_CHANGES.suspension;

    await suspendUser(
      userId,
      24
    );

    await trustService.handleTrustEvent(
      userId,
      'SUSPENSION'
    );


    // Invalidate JWT sessions by blacklisting this user_id

    const authService =
      require('../auth/auth.service');

    const alreadyBlacklisted =
      await authService.isUserBlacklisted(userId);


    if (!alreadyBlacklisted) {

      await authService.blacklistUser(
        userId
      );
    }


    // Emit socket event

    const { getIO } =
      require('../../config/socket.config');

    const io = getIO();


    if (io && anonId) {

      io.to(anonId).emit(
        'user:suspended',
        {
          message:
            'Your account has been suspended for 24 hours due to a safety violation.'
        }
      );
    }
  }


  // 3. Update Behavior Score

  if (
    !skipScoreUpdate &&
    scoreChange !== 0
  ) {

    await updateBehaviorScore(
      userId,
      scoreChange
    );
  }


  // 4. Audit Log

  const actionMap = {

    warning:
      'WARNING_ISSUED',

    removal:
      'CONTENT_REMOVED',

    suspension:
      'ACCOUNT_SUSPENDED',

    identity_reveal:
      'IDENTITY_REVEALED'
  };


  await logAuditAction(
    userId,
    actionMap[level],
    'user',
    userId,
    'HIGH',
    {
      reason,
      score_change: scoreChange,
      escalation_level: level
    }
  );


  // 5. Trigger Socket Alert for HIGH severity

  const { getIO } =
    require('../../config/socket.config');

  const io = getIO();


  if (io) {

    io.to('admin_room').emit(
      'safety:alert',
      {
        anonymous_id: anonId,
        content_type: 'escalation',
        severity: 'HIGH',
        escalation_level: level,
        timestamp: new Date()
      }
    );
  }
}


// ============================================================
// 7. BEHAVIOR SCORE
// ============================================================

async function updateBehaviorScore(
  userId,
  change
) {

  const [oldRows] = await query(
    'SELECT behavior_score FROM profiles WHERE user_id = ?',
    [userId]
  );

  const oldScore =
    oldRows[0]?.behavior_score || 100;


  await query(
    'UPDATE profiles SET behavior_score = GREATEST(0, LEAST(100, behavior_score + ?)) WHERE user_id = ?',
    [
      change,
      userId
    ]
  );


  const [rows] = await query(
    'SELECT behavior_score, anonymous_id FROM profiles WHERE user_id = ?',
    [userId]
  );

  const newScore =
    rows[0]?.behavior_score;

  const anonId =
    rows[0]?.anonymous_id;


  // Threshold:
  // Only trigger suspension if score JUST crossed below 10

  if (
    newScore < 10 &&
    oldScore >= 10
  ) {

    await escalateUser(
      userId,
      'suspension',
      'Behavior score fell below 10',
      null,
      true
    );
  }


  // Socket Alert if below 30

  if (newScore < 30) {

    const { getIO } =
      require('../../config/socket.config');

    const io = getIO();


    if (io) {

      io.to('admin_room').emit(
        'safety:low_score',
        {
          anonymous_id: anonId,
          behavior_score: newScore,
          timestamp: new Date()
        }
      );
    }
  }
}


// ============================================================
// 8. MODERATION QUEUE
// ============================================================

async function addToModerationQueue(
  contentType,
  contentId,
  text,
  userId,
  severity,
  reason
) {

  const [userRows] = await query(
    'SELECT anonymous_id FROM profiles WHERE user_id = ?',
    [userId]
  );

  const anonId =
    userRows[0]?.anonymous_id;


  const [result] = await query(
    'INSERT INTO moderation_queue (content_type, content_id, content_text, user_id, anonymous_id, ai_severity, ai_reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [
      contentType,
      contentId,
      text,
      userId,
      anonId || null,
      severity,
      reason
    ]
  );


  // Emit real-time alert to admins

  const { getIO } =
    require('../../config/socket.config');

  const io = getIO();


  if (io) {

    io.to('admin_room').emit(
      'admin:new_moderation',
      {
        id: result.insertId,
        content_type: contentType,
        content_id: contentId,
        content_text: text,
        user_id: userId,
        anonymous_id: anonId || null,
        ai_severity: severity,
        ai_reason: reason,
        status: 'pending',
        created_at: new Date()
      }
    );
  }
}


// ============================================================
// 9. USER SUSPENSION
// ============================================================

async function suspendUser(
  userId,
  hours
) {

  const suspensionUntil =
    new Date(
      Date.now() +
      hours * 60 * 60 * 1000
    );


  await query(
    'UPDATE users SET is_locked = 1, lock_until = ? WHERE id = ?',
    [
      suspensionUntil,
      userId
    ]
  );
}


// ============================================================
// 10. AUDIT LOG
// ============================================================

async function logAuditAction(
  userId,
  action,
  targetType,
  targetId,
  severity,
  details
) {

  await query(
    'INSERT INTO audit_logs (user_id, action, target_type, target_id, severity, details) VALUES (?, ?, ?, ?, ?, ?)',
    [
      userId,
      action,
      targetType,
      targetId
        ? String(targetId)
        : null,
      severity,
      JSON.stringify(details)
    ]
  );
}


// ============================================================
// 11. USER NOTIFICATION
// ============================================================

async function notifyUser(
  userId,
  type,
  message
) {

  try {

    await query(
      'INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)',
      [
        userId,
        type,
        message
      ]
    );

  } catch (err) {

    logger.warn(
      `Failed to notify user ${userId}: ${err.message}`
    );
  }
}


// ============================================================
// 12. GET BEHAVIOR SCORE
// ============================================================

async function getBehaviorScore(
  userId
) {

  const [rows] = await query(
    'SELECT behavior_score FROM profiles WHERE user_id = ?',
    [userId]
  );

  return rows[0]?.behavior_score || 0;
}


// ============================================================
// 13. VIOLATION RECORD
// ============================================================

async function addViolationRecord(
  userId,
  violationType,
  severity
) {

  const [result] = await query(
    'INSERT INTO violation_history (user_id, violation_type, severity) VALUES (?, ?, ?)',
    [
      userId,
      violationType,
      severity
    ]
  );

  return result;
}


// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  monitorContent,
  escalateUser,
  updateBehaviorScore,
  getBehaviorScore,
  addViolationRecord,
  addToModerationQueue,
  logAuditAction
};