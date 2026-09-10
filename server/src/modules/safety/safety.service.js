const { query } = require('../../config/db.config');
const logger = require('../../utils/logger');
const { analyzeWithPerspective } = require('../../utils/perspectiveApi');
const { analyzeContext } = require('../../utils/geminiApi');
const AppError = require('../../utils/AppError');

// 1. Keywords
const selfHarmKeywords = [
  // English
  'suicide', 'kill myself', 'end my life', 'want to die',
  'hurt myself', 'self harm', 'cutting myself', 'overdose',
  'no reason to live', 'better off dead', 'end it all',
  // Roman Urdu
  'khud ko maar lunga', 'khud ko khatam kar lunga',
  'marna chahta hoon', 'marna chahti hoon',
  'jeena nahi chahta', 'jeena nahi chahti',
  'zindagi khatam karna chahta hoon',
  'apni jaan dena chahta hoon',
  'mar jana chahta hoon',
  'khud ko hurt karunga',
  'zindagi se tang aa gaya hoon',
  'jina nahi chahta',
  // Urdu (actual script)
  'خود کو مارنا', 'مرنا چاہتا ہوں', 'زندگی ختم کرنا',
  'جینا نہیں چاہتا', 'خود کو نقصان'
];

const threatKeywords = [
  // English
  'murder', 'kill you', 'find you', 'hunt you down',
  'hurt you', 'beat you', 'destroy you', 'end you',
  'come for you', 'make you pay', 'you will regret',
  'i will get you', 'watch your back',
  // Roman Urdu
  'maar dunga', 'maar dungi',
  'khatam kar dunga', 'khatam kar dungi',
  'dekh lunga', 'dekh lungi',
  'nahi chodunga', 'nahi chodungi',
  'barbad kar dunga', 'barbad kar dungi',
  'thok dunga', 'utha lunga',
  'ghar aa jaunga', 'address pata hai mujhe',
  'chhod nahi dunga', 'tang karunga',
  'laat marunga', 'pitai karunga',
  'jan se maar dunga', 'khoon kar dunga',
  'dekh lena', 'bura hoga tera',
  // Urdu script
  'مار دوں گا', 'ختم کر دوں گا', 'دیکھ لوں گا',
  'نہیں چھوڑوں گا', 'برباد کر دوں گا'
];

const insultKeywords = [
  // English
  'stupid', 'idiot', 'dumb', 'loser', 'pathetic',
  'shut up', 'hate you', 'worthless', 'useless',
  'moron', 'fool', 'trash', 'garbage', 'disgusting',
  'you suck', 'go to hell', 'freak', 'creep',
  // Roman Urdu
  'bewaqoof', 'gadha', 'jahil', 'kamina', 'kameena',
  'harami', 'bakwaas', 'ullu', 'pagal', 'baigharat',
  'ganda', 'badtameez', 'jhootha', 'jhoothi',
  'besharam', 'beghairat', 'kutta', 'suar',
  'donkey', 'nalayak', 'nikamma', 'nikammi',
  'ghatiya', 'bekar', 'lanat', 'chup kar',
  'bhai nahi hai tera', 'teri aukat nahi',
  'tujhe pata nahi kuch', 'akal nahi hai tujhe',
  // Urdu script
  'بیوقوف', 'گدھا', 'جاہل', 'کمینہ', 'حرامی',
  'بکواس', 'الو', 'پاگل', 'بے غیرت', 'گندا'
];

const harassmentKeywords = [
  // English
  'i know where you live', 'i will follow you',
  'send me pictures', 'meet me alone',
  'dont tell anyone', 'keep it secret',
  'you owe me', 'do what i say',
  // Roman Urdu
  'address bata', 'ghar bata',
  'akele milna', 'kisi ko mat batana',
  'photo bhejo', 'tasveer bhejo',
  'meri baat mano', 'kuch nahi kahunga',
  'tera pata hai mere paas',
  'main jaanta hoon tujhe',
  'chup rehna warna',
  'kisi ko bataya toh',
  // Urdu script
  'گھر بتاؤ', 'اکیلے ملنا', 'کسی کو مت بتانا',
  'تصویر بھیجو', 'چپ رہنا'
];

// 2. Score Changes
const SCORE_CHANGES = {
  helpful_response: 5,
  resolved_chat: 3,
  warning_received: -2,
  content_removed: -4,
  suspension: -6,
  sos_false_alarm: -4
};

/**
 * Unified Monitoring Pipeline
 */
async function monitorContent(content, contentType, userId, contentId = null) {
  const text = (content || '').toLowerCase();
  let severity = 'LOW';
  let reason = null;
  let source = 'clean';

  // Layer 1: Keyword Filtering
  const hasSelfHarm = selfHarmKeywords.some(kw => text.includes(kw));
  const hasThreat = threatKeywords.some(kw => text.includes(kw));
  const hasHarassment = harassmentKeywords.some(kw => text.includes(kw));
  const hasInsult = insultKeywords.some(kw => text.includes(kw));

  if (hasSelfHarm) {
    severity = 'HIGH';
    reason = 'Self-Harm Detected';
    source = 'keyword';
  } else if (hasThreat) {
    severity = 'HIGH';
    reason = 'Threat Detected';
    source = 'keyword';
  } else if (hasHarassment) {
    severity = 'HIGH';
    reason = 'Harassment Detected';
    source = 'keyword';
  } else if (hasInsult) {
    severity = 'MEDIUM';
    reason = 'Insult Detected';
    source = 'keyword';
  }

  // Layer 2: Perspective API (TensorFlow) - Only if not live chat (as per prompt)
  if (severity === 'LOW' && contentType !== 'message') {
    const aiResult = await analyzeWithPerspective(content);
    severity = aiResult.severity;
    if (severity !== 'LOW') {
      reason = `AI Flagged: ${aiResult.flagged_attributes.join(', ')}`;
      source = 'perspective';
    }
  }

  // Layer 3: Context Pattern Analysis (Gemini Layer)
  if (severity === 'LOW') {
    const { analyzeContext } = require('../../utils/geminiApi');
    const contextResult = await analyzeContext(userId);
    if (contextResult.risk_level !== 'LOW') {
      severity = contextResult.risk_level;
      reason = `Pattern Detected: ${contextResult.pattern_detected} (${contextResult.recommendation})`;
      source = 'gemini';
    }
  }

  // Action based on severity
  if (severity === 'HIGH') {
    if (contentType === 'message') {
      // For live chat: only warn the user, do NOT remove/suspend immediately.
      // Suspension happens automatically once behavior score falls below 10.
      await escalateUser(userId, 'warning', reason, contentId);
    } else {
      // For posts, uploads, profiles: full removal
      await escalateUser(userId, 'removal', reason, contentId);
    }
  } else if (severity === 'MEDIUM' && (contentType !== 'message' || contentId)) {
    await addToModerationQueue(contentType, contentId, content, userId, 'MEDIUM', reason);
  }

  // Audit Log
  await logAuditAction(userId, 'CONTENT_FLAGGED', contentType, contentId, severity, { reason });

  return { severity, reason, source };
}

/**
 * Escalation System
 */
async function escalateUser(userId, level, reason, contentId = null, skipScoreUpdate = false) {
  const [userRows] = await query('SELECT anonymous_id FROM profiles WHERE user_id = ?', [userId]);
  const anonId = userRows[0]?.anonymous_id;

  // 1. Create Escalation Record
  await query(
    'INSERT INTO escalation_records (user_id, anonymous_id, level, reason, content_ref) VALUES (?, ?, ?, ?, ?)',
    [userId, anonId || null, level, reason, contentId ? String(contentId) : null]
  );

  // 2. Perform Action
  let scoreChange = 0;
  const trustService = require('../trust/trust.service');

  if (level === 'warning') {
    scoreChange = SCORE_CHANGES.warning_received;
    await notifyUser(userId, 'SAFETY_WARNING', `Warning: ${reason}`);
    await trustService.handleTrustEvent(userId, 'WARNING_RECEIVED');
  } else if (level === 'removal') {
    scoreChange = SCORE_CHANGES.content_removed;
    await notifyUser(userId, 'CONTENT_REMOVED', `Your content was removed due to: ${reason}`);
    await trustService.handleTrustEvent(userId, 'CONTENT_REMOVED');
  } else if (level === 'suspension') {
    scoreChange = SCORE_CHANGES.suspension;
    await suspendUser(userId, 24); // 24 hours
    await trustService.handleTrustEvent(userId, 'SUSPENSION');

    // Invalidate JWT sessions by blacklisting this user_id
    const authService = require('../auth/auth.service');
    const alreadyBlacklisted = await authService.isUserBlacklisted(userId);
    if (!alreadyBlacklisted) {
      await authService.blacklistUser(userId);
    }

    // Emit socket event — frontend shows warning banner, then logs out
    const { getIO } = require('../../config/socket.config');
    const io = getIO();
    if (io && anonId) {
      io.to(anonId).emit('user:suspended', {
        message: 'Your account has been suspended for 24 hours due to a safety violation.'
      });
    }
  }

  // 3. Update Behavior Score (if not skipped)
  if (!skipScoreUpdate && scoreChange !== 0) {
    await updateBehaviorScore(userId, scoreChange);
  }

  // 4. Audit Log
  const actionMap = {
    warning: 'WARNING_ISSUED',
    removal: 'CONTENT_REMOVED',
    suspension: 'ACCOUNT_SUSPENDED',
    identity_reveal: 'IDENTITY_REVEALED'
  };
  await logAuditAction(userId, actionMap[level], 'user', userId, 'HIGH', { reason, score_change: scoreChange, escalation_level: level });

  // 5. Trigger Socket Alert for HIGH severity
  const { getIO } = require('../../config/socket.config');
  const io = getIO();
  if (io) {
    io.to('admin_room').emit('safety:alert', {
      anonymous_id: anonId,
      content_type: 'escalation',
      severity: 'HIGH',
      escalation_level: level,
      timestamp: new Date()
    });
  }
}

async function updateBehaviorScore(userId, change) {
  const [oldRows] = await query('SELECT behavior_score FROM profiles WHERE user_id = ?', [userId]);
  const oldScore = oldRows[0]?.behavior_score || 100;

  await query('UPDATE profiles SET behavior_score = GREATEST(0, LEAST(100, behavior_score + ?)) WHERE user_id = ?', [change, userId]);

  const [rows] = await query('SELECT behavior_score, anonymous_id FROM profiles WHERE user_id = ?', [userId]);
  const newScore = rows[0]?.behavior_score;
  const anonId = rows[0]?.anonymous_id;

  // Thresholds: Only trigger suspension if the score JUST crossed below 10
  if (newScore < 10 && oldScore >= 10) {
    await escalateUser(userId, 'suspension', 'Behavior score fell below 10', null, true);
  }

  // Socket Alert if below 30
  if (newScore < 30) {
    const { getIO } = require('../../config/socket.config');
    const io = getIO();
    if (io) {
      io.to('admin_room').emit('safety:low_score', {
        anonymous_id: anonId,
        behavior_score: newScore,
        timestamp: new Date()
      });
    }
  }
}

async function addToModerationQueue(contentType, contentId, text, userId, severity, reason) {
  const [userRows] = await query('SELECT anonymous_id FROM profiles WHERE user_id = ?', [userId]);
  const anonId = userRows[0]?.anonymous_id;

  const [result] = await query(
    'INSERT INTO moderation_queue (content_type, content_id, content_text, user_id, anonymous_id, ai_severity, ai_reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [contentType, contentId, text, userId, anonId || null, severity, reason]
  );

  // Emit real-time alert to admins
  const { getIO } = require('../../config/socket.config');
  const io = getIO();
  if (io) {
    io.to('admin_room').emit('admin:new_moderation', {
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
    });
  }
}

async function suspendUser(userId, hours) {
  const suspensionUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
  await query('UPDATE users SET is_locked = 1, lock_until = ? WHERE id = ?', [suspensionUntil, userId]);

  // Invalidate sessions - assuming we have a way to do this, e.g. updating a version or just locking
  // For JWT, locking the user is enough if the auth middleware checks is_locked.
}

async function logAuditAction(userId, action, targetType, targetId, severity, details) {
  await query(
    'INSERT INTO audit_logs (user_id, action, target_type, target_id, severity, details) VALUES (?, ?, ?, ?, ?, ?)',
    [userId, action, targetType, targetId ? String(targetId) : null, severity, JSON.stringify(details)]
  );
}

async function notifyUser(userId, type, message) {
  // Implementation for user notifications (e.g. socket emit or DB entry)
  // Assuming a generic notification system exists or we just log it for now.
  try {
    await query('INSERT INTO notifications (user_id, type, message) VALUES (?, ?, ?)', [userId, type, message]);
  } catch (err) {
    logger.warn(`Failed to notify user ${userId}: ${err.message}`);
  }
}

async function getBehaviorScore(userId) {
  const [rows] = await query('SELECT behavior_score FROM profiles WHERE user_id = ?', [userId]);
  return rows[0]?.behavior_score || 0;
}

async function addViolationRecord(userId, violationType, severity) {
  const [result] = await query(
    'INSERT INTO violation_history (user_id, violation_type, severity) VALUES (?, ?, ?)',
    [userId, violationType, severity]
  );
  return result;
}

module.exports = {
  monitorContent,
  escalateUser,
  updateBehaviorScore,
  getBehaviorScore,
  addViolationRecord,
  addToModerationQueue,
  logAuditAction,
  analyzeContext // Exporting context analysis too
};
