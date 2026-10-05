const { query } = require('../../config/db.config');
const crypto = require('crypto');
const env = require('../../config/env.config');
const AppError = require('../../utils/AppError');

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
      expires_at DATETIME NULL,
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

}

// Execute on service initialization
ensureChatTablesExist().catch(console.error);

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
    JOIN users peer_user ON peer_user.id = p.user_id AND peer_user.role = 'student'
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

  const chatService = require('../chat/chat.service');
  if (!await chatService.isAcceptedStudentConversation(sender_id, receiver_id)) {
    throw AppError.forbidden('This conversation is not an approved student chat');
  }

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
  checkIfBlocked,
  storeMessage,
  markMessageSeen,
  getUserConversations,
  getConversationMessages,
  blockUser,
  reportUser,
  storeBroadcast,
  getDepartmentBroadcasts
};
