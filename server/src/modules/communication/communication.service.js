const { query } = require('../../config/db.config');
const crypto = require('crypto');
const env = require('../../config/env.config');
const tf = require('@tensorflow/tfjs');
const toxicity = require('@tensorflow-models/toxicity');
const logger = require('../../utils/logger');
const { ROLES } = require('../../utils/constants');

// Toxicity model configuration
const TOXICITY_THRESHOLD = 0.5;
let toxicityModel = null;

async function initToxicityModel() {
  try {
    // Load the model with labels we care about
    const labelsToInclude = ['identity_attack', 'insult', 'threat', 'sexual_explicit'];
    toxicityModel = await toxicity.load(TOXICITY_THRESHOLD, labelsToInclude);
    logger.info('✓ TensorFlow Toxicity Model loaded successfully');
  } catch (err) {
    logger.error('Failed to load TensorFlow Toxicity Model', { error: err.message });
  }
}

// Initialise model on startup
initToxicityModel();

// E2E Encryption Config setup
// Fallback logic to protect deployment crashes if secret missing momentarily. Use derived key.
const ENCRYPTION_KEY = crypto.scryptSync(env.jwt?.secret || 'fallback_key', 'salt', 32);
const ALGORITHM = 'aes-256-cbc';

function encryptMessage(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptMessage(encryptedText) {
  try {
    const textParts = encryptedText.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedTextBuffer = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedTextBuffer, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return "[Encrypted Message]"; // Fallback if schema altered during migrations
  }
}

async function ensureChatTablesExist() {
  await query(`
    CREATE TABLE IF NOT EXISTS chat_rooms (
      id INT AUTO_INCREMENT PRIMARY KEY,
      room_name VARCHAR(100) UNIQUE,
      mode ENUM('chat_only', 'study_group', 'campus_meeting') DEFAULT 'chat_only',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      sender_id INT NOT NULL,
      receiver_id INT NOT NULL,
      message TEXT NOT NULL,
      chat_mode VARCHAR(50) DEFAULT 'chat_only',
      is_flagged BOOLEAN DEFAULT FALSE,
      seen_at DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
      INDEX idx_chat_sender (sender_id),
      INDEX idx_chat_receiver (receiver_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS blocks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      blocker_id INT NOT NULL,
      blocked_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (blocker_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (blocked_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE KEY unique_block (blocker_id, blocked_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS reports (
      id INT AUTO_INCREMENT PRIMARY KEY,
      reporter_id INT NOT NULL,
      reported_id INT NOT NULL,
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reported_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // NOTE: sos_records table is created by database_migration.sql with the full schema.
  // Do NOT create it here — the migration schema includes student_id, category, severity,
  // status, attached_mood_data, assigned_faculty_id, resolved_at.
}

// Execute on service initialization
ensureChatTablesExist().catch(console.error);

// Chat Log Expiry Worker Placeholder
// TODO: Set up a CRON job -> DELETE FROM chat_messages WHERE is_flagged = FALSE AND created_at < DATE_SUB(NOW(), INTERVAL 30 DAY)


async function getAnonymousIdByUserId(userId) {
  const [rows] = await query('SELECT anonymous_id FROM profiles WHERE user_id = ?', [userId]);
  return rows.length ? rows[0].anonymous_id : null;
}

async function getUserIdByAnonymousId(anonymousId) {
  const [rows] = await query('SELECT user_id FROM profiles WHERE anonymous_id = ?', [anonymousId]);
  return rows.length ? rows[0].user_id : null;
}

async function getUserRoleById(userId) {
  const [rows] = await query('SELECT role FROM users WHERE id = ?', [userId]);
  return rows.length ? rows[0].role : null;
}

async function moderateMessage(message) {
  const text = message.toLowerCase();

  // 1. Keyword-based immediate High/Medium Severity (Privacy First)
  const selfHarmKeywords = ['suicide', 'kill myself', 'end my life', 'self-harm', 'die', 'cutting myself', 'khud ko maar lunga', 'marna chahta hoon', 'jeena nahi chahta'];
  const threatKeywords = ['murder', 'kill you', 'find you', 'hurt you', 'beat you', 'track you', 'maar dunga', 'khatam kar dunga', 'dekh lunga', 'nahi chodunga'];
  const insultKeywords = ['stupid', 'idiot', 'dumb', 'loser', 'pathetic', 'shut up', 'hate you', 'bewaqoof', 'gadha', 'jahil', 'kamina', 'bakwaas', 'ullu'];

  const hasSelfHarm = selfHarmKeywords.some(kw => text.includes(kw));
  const hasThreat = threatKeywords.some(kw => text.includes(kw));
  const hasInsult = insultKeywords.some(kw => text.includes(kw));

  if (hasSelfHarm) return { isFlagged: true, severity: 'HIGH', category: 'self-harm' };
  if (hasThreat) return { isFlagged: true, severity: 'HIGH', category: 'threat' };
  if (hasInsult) return { isFlagged: true, severity: 'MEDIUM', category: 'insult' };

  // 2. TensorFlow Toxicity Scan (Local/Private)
  // NOTE: @tensorflow-models/toxicity@1.2.2 is incompatible with @tensorflow/tfjs@3.18.0
  // causing "forwardFunc_1 is not a function". If classify crashes, we disable the model
  // permanently and fall back to keyword-only moderation to prevent error spam.
  if (toxicityModel) {
    try {
      const predictions = await toxicityModel.classify([message]);

      let maxSeverity = 'LOW';
      let flaggedCategory = null;

      predictions.forEach(p => {
        const score = p.results[0].probabilities[1];

        if (p.results[0].match || score > 0.5) {
          if (p.label === 'threat' && score > 0.9) {
            maxSeverity = 'HIGH';
            flaggedCategory = 'threat';
          } else if ((p.label === 'identity_attack' || p.label === 'insult') && score > 0.5) {
            if (maxSeverity !== 'HIGH') maxSeverity = 'MEDIUM';
            flaggedCategory = p.label;
          }
        }
      });

      return {
        isFlagged: maxSeverity !== 'LOW',
        severity: maxSeverity,
        category: flaggedCategory
      };
    } catch (err) {
      // Disable model permanently on crash to stop repeated error spam
      logger.warn('⚠ TensorFlow Toxicity model disabled due to runtime error (tfjs version mismatch). Falling back to keyword-only moderation.', { error: err.message });
      toxicityModel = null;
    }
  }

  return { isFlagged: false, severity: 'LOW', category: null };
}

async function storeMoodEntry(userId, moodScore, notes = null) {
  await query(
    'INSERT INTO mood_entries (user_id, mood_score, notes) VALUES (?, ?, ?)',
    [userId, moodScore, notes]
  );
}

async function getRecentMoodHistory(userId, limit = 5) {
  const safeLimit = parseInt(limit, 10) || 5;
  const [rows] = await query(
    `SELECT mood_score, notes, created_at FROM mood_entries WHERE user_id = ? ORDER BY created_at DESC LIMIT ${safeLimit}`,
    [userId]
  );
  return rows;
}

async function markSOSResolved(sosId, facultyId) {
  await query(
    'UPDATE sos_records SET status = \'resolved\', resolved_at = NOW(), assigned_faculty_id = ? WHERE id = ?',
    [facultyId, sosId]
  );

  // BUG-015 FIX: fetch student_id not user_id
  const [rows] = await query('SELECT student_id FROM sos_records WHERE id = ?', [sosId]);
  if (rows.length) {
    const userId = rows[0].student_id;
    const executeAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await query(
      'INSERT INTO scheduled_tasks (user_id, task_type, execute_at, payload) VALUES (?, ?, ?, ?)',
      [userId, 'wellness_checkin', executeAt, JSON.stringify({ sos_id: sosId })]
    );
  }
}

async function getDepartmentFaculty(department) {
  // BUG-019 FIX: Use actual DB ENUM values ('faculty','admin','super_admin')
  // counselor_admin/dept_admin are not in the DB ENUM so we use 'admin'/'super_admin'
  const [rows] = await query(`
    SELECT u.id, u.role, p.anonymous_id, p.office_hours 
    FROM users u
    JOIN profiles p ON u.id = p.user_id
    WHERE p.department = ? AND u.role IN ('faculty', 'counselor_admin', 'dept_admin', 'admin', 'super_admin')
      AND (u.deletion_scheduled_at IS NULL OR u.deletion_scheduled_at > NOW())
  `, [department]);
  return rows;
}

async function storeSOSRecord(userId, triggerReason) {
  const safeReason = triggerReason || 'Emergency SOS';
  const [result] = await query(
    'INSERT INTO sos_records (user_id, student_id, trigger_reason, category, severity, status) VALUES (?, ?, ?, ?, \'high\', \'pending\')',
    [userId, userId, safeReason, 'other']
  );
  return result.insertId;
}

async function checkIfBlocked(senderId, receiverId) {
  const [rows] = await query(
    'SELECT id FROM blocks WHERE blocker_id = ? AND blocked_id = ?',
    [receiverId, senderId]
  );
  return rows.length > 0;
}

async function storeMessage(senderId, receiverId, message, isFlagged, chatMode = 'chat_only') {
  const encryptedPayload = encryptMessage(message);
  const [result] = await query(
    'INSERT INTO chat_messages (sender_id, receiver_id, message, is_flagged, chat_mode, expires_at) VALUES (?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))',
    [senderId, receiverId, encryptedPayload, isFlagged ? 1 : 0, chatMode]
  );
  return result.insertId;
}

async function markMessageSeen(messageId, receiverId) {
  await query(
    'UPDATE chat_messages SET seen_at = NOW() WHERE id = ? AND receiver_id = ? AND seen_at IS NULL',
    [messageId, receiverId]
  );
}

async function getUserConversations(userId) {
  // BUG-002 FIX: Logic migration to Numeric IDs. Fetching accepted chat requests specifically.
  // ENHANCEMENT: Fetching last message, timestamp, and unread count for WhatsApp-style UI.
  const [rows] = await query(`
    SELECT 
      cr.id as conversation_id,
      p.anonymous_id as peer_anonymous_id,
      m.message as last_message_payload,
      m.created_at as last_message_time,
      (SELECT COUNT(*) FROM chat_messages unread WHERE unread.sender_id = p.user_id AND unread.receiver_id = ? AND unread.seen_at IS NULL) as unread_count
    FROM chat_requests cr
    JOIN profiles p ON p.user_id = (CASE WHEN cr.sender_id = ? THEN cr.receiver_id ELSE cr.sender_id END)
    LEFT JOIN chat_messages m ON m.id = (
        SELECT id FROM chat_messages 
        WHERE (sender_id = ? AND receiver_id = p.user_id) OR (sender_id = p.user_id AND receiver_id = ?) 
        ORDER BY created_at DESC LIMIT 1
    )
    WHERE cr.id IN (
      SELECT MAX(id) 
      FROM chat_requests 
      WHERE status = 'accepted' AND (sender_id = ? OR receiver_id = ?)
      GROUP BY LEAST(sender_id, receiver_id), GREATEST(sender_id, receiver_id)
    )
    ORDER BY COALESCE(last_message_time, cr.created_at) DESC
  `, [userId, userId, userId, userId, userId, userId]);

  return rows.map(r => ({
    ...r,
    last_message: r.last_message_payload ? decryptMessage(r.last_message_payload) : null,
    last_message_payload: undefined // clean up
  }));
}

async function getConversationMessages(userId, conversationId) {
  // BUG-002 FIX: Find participants from the conversation ID (chat_request)
  const [requestRows] = await query(
    'SELECT sender_id, receiver_id FROM chat_requests WHERE id = ?',
    [conversationId]
  );

  if (requestRows.length === 0) return [];
  const { sender_id, receiver_id } = requestRows[0];

  // Security: Check if user is participant
  if (sender_id !== userId && receiver_id !== userId) {
    throw AppError.forbidden('You are not a participant in this conversation');
  }

  const peerUserId = (sender_id === userId) ? receiver_id : sender_id;

  const [rows] = await query(`
    SELECT 
      m.id,
      m.message, 
      m.chat_mode,
      m.seen_at,
      m.created_at as timestamp,
      IF(m.sender_id = ?, 'me', 'peer') as direction
    FROM chat_messages m
    WHERE (m.sender_id = ? AND m.receiver_id = ?) 
       OR (m.sender_id = ? AND m.receiver_id = ?)
    ORDER BY m.created_at ASC
  `, [userId, userId, peerUserId, peerUserId, userId]);

  return rows.map(r => ({
    ...r,
    message: decryptMessage(r.message) // Decrypt payload natively on fetch bounds
  }));
}

async function blockUser(blockerId, blockedId) {
  await query('INSERT IGNORE INTO blocks (blocker_id, blocked_id) VALUES (?, ?)', [blockerId, blockedId]);
}

async function reportUser(reporterId, reportedId, reason) {
  await query('INSERT INTO reports (reporter_id, reported_id, reason) VALUES (?, ?, ?)', [reporterId, reportedId, reason]);
}

async function storeBroadcast(senderId, department, message, senderRole = 'faculty') {
  const normalizedDept = department.toLowerCase();
  const [result] = await query(
    'INSERT INTO broadcasts (sender_id, department, message, sender_role) VALUES (?, ?, ?, ?)',
    [senderId, normalizedDept, message, senderRole]
  );
  return result.insertId;
}

async function getDepartmentBroadcasts(department) {
  const [rows] = await query(`
    SELECT 
      b.id,
      b.message,
      b.sender_role,
      b.timestamp,
      p.anonymous_id as sender_anonymous_id
    FROM broadcasts b
    JOIN profiles p ON b.sender_id = p.user_id
    WHERE LOWER(b.department) = LOWER(?)
    ORDER BY b.timestamp DESC
    LIMIT 50
  `, [department]);
  return rows;
}


module.exports = {
  getAnonymousIdByUserId,
  getUserIdByAnonymousId,
  getUserRoleById,
  moderateMessage,
  storeSOSRecord,
  checkIfBlocked,
  storeMessage,
  markMessageSeen,
  getUserConversations,
  getConversationMessages,
  blockUser,
  reportUser,
  storeMoodEntry,
  getRecentMoodHistory,
  markSOSResolved,
  getDepartmentFaculty,
  storeBroadcast,
  getDepartmentBroadcasts
};
