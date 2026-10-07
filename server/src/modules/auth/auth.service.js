const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { query } = require('../../config/db.config');
const env = require('../../config/env.config');
const { ROLES } = require('../../utils/constants');

async function findUserByEmail(email) {
  const [rows] = await query('SELECT * FROM users WHERE email = ?', [email]);
  return rows[0] || null;
}

function determineRoleFromEmail(email) {
  const sanitized = email.toLowerCase();
  
  // Guard clause: Prevent public escalation to super_admin or admin
  if (sanitized.includes('super_admin') || sanitized.includes('root') || sanitized.includes('sysadmin') || sanitized.includes('admin') || sanitized.includes('hod_') || sanitized.includes('dept_head_')) {
    return ROLES.STUDENT; 
  }

  if (sanitized.includes('faculty') || sanitized.includes('staff')) {
    return ROLES.FACULTY;
  }
  
  return ROLES.STUDENT;
}

const ADJECTIVES = ['Silent', 'Brave', 'Clever', 'Calm', 'Swift', 'Gentle', 'Fierce', 'Noble', 'Wise', 'Bright'];
const ANIMALS = ['Falcon', 'Wolf', 'Bear', 'Owl', 'Fox', 'Stag', 'Hawk', 'Lion', 'Tiger', 'Eagle'];

function generateAdvancedAnonymousId() {
  const adj = ADJECTIVES[crypto.randomInt(0, ADJECTIVES.length)];
  const animal = ANIMALS[crypto.randomInt(0, ANIMALS.length)];
  const num = crypto.randomInt(1000, 10000); // 4 digits
  return `${adj}${animal}#${num}`;
}

async function registerUser(email, password) {
  // Enforce high-entropy salt for production compliance
  const passwordHash = await bcrypt.hash(password, 12);
  const role = determineRoleFromEmail(email);

  const [userResult] = await query(
    'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
    [email.toLowerCase(), passwordHash, role]
  );
  
  const userId = userResult.insertId;
  const anonymousId = generateAdvancedAnonymousId();

  // 1. Map into anonymous_id_map table
  await query(
    'INSERT INTO anonymous_id_map (user_id, anonymous_id) VALUES (?, ?)',
    [userId, anonymousId]
  );

  // 2. Store directly in profiles for fast loopups
  await query(
    'INSERT INTO profiles (user_id, anonymous_id) VALUES (?, ?)',
    [userId, anonymousId]
  );

  return { id: userId, email: email.toLowerCase(), role, anonymous_id: anonymousId };
}

async function verifyPassword(plainPassword, hashedPassword) {
  return bcrypt.compare(plainPassword, hashedPassword);
}

async function incrementFailedAttempts(userId) {
  // Use atomic increment to prevent race conditions on brute force
  await query('UPDATE users SET failed_attempts = failed_attempts + 1 WHERE id = ?', [userId]);
  
  const [rows] = await query('SELECT failed_attempts FROM users WHERE id = ?', [userId]);
  const attempts = rows[0]?.failed_attempts || 0;

  if (attempts >= 5) {
    const lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
    await query(
      'UPDATE users SET is_locked = true, lock_until = ? WHERE id = ?',
      [lockUntil, userId]
    );
    return true; // Account just got locked
  }
  
  return false;
}

async function resetFailedAttempts(userId) {
  await query(
    'UPDATE users SET failed_attempts = 0, is_locked = false, lock_until = NULL WHERE id = ?',
    [userId]
  );
  // Remove user from blacklist so their new tokens aren't immediately rejected
  await query('DELETE FROM blacklisted_tokens WHERE user_id = ?', [userId]);
}

async function updateLastLogin(userId) {
  await query('UPDATE users SET last_login = NOW() WHERE id = ?', [userId]);
}

async function unlockAccount(userId) {
  await query(
    'UPDATE users SET failed_attempts = 0, is_locked = false, lock_until = NULL WHERE id = ?',
    [userId]
  );
  await query('DELETE FROM blacklisted_tokens WHERE user_id = ?', [userId]);
}

function generateAccessToken(payload) {
  // Enforce stateless session via standardized token timeout mapping
  return jwt.sign(payload, env.jwt.secret, { expiresIn: env.jwt.expiresIn });
}

async function setOTP(userId, otp) {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
  await query(
    'UPDATE users SET otp_code = ?, otp_expires_at = ?, otp_failed_attempts = 0 WHERE id = ?',
    [otp, expiresAt, userId]
  );
}

async function verifyOTP(userId, otp) {
  const [rows] = await query(
    'SELECT otp_code, otp_expires_at, otp_failed_attempts, is_locked, lock_until FROM users WHERE id = ?',
    [userId]
  );
  
  const user = rows[0];
  if (!user || user.otp_code !== otp || new Date(user.otp_expires_at) < new Date()) {
    // Increment failed attempts for OTP brute force protection
    await query('UPDATE users SET otp_failed_attempts = otp_failed_attempts + 1 WHERE id = ?', [userId]);
    
    if (user && user.otp_failed_attempts + 1 >= 3) {
      const lockUntil = new Date(Date.now() + 15 * 60 * 1000); // 15 min lock
      await query('UPDATE users SET is_locked = true, lock_until = ? WHERE id = ?', [lockUntil, userId]);
      return { valid: false, locked: true };
    }
    return { valid: false, locked: false };
  }

  // OTP is valid. Clear it immediately (one-time use)
  await query(
    'UPDATE users SET otp_code = NULL, otp_expires_at = NULL, otp_failed_attempts = 0 WHERE id = ?',
    [userId]
  );
  return { valid: true, locked: false };
}

async function resetUserPassword(userId, newPassword) {
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await query('UPDATE users SET password_hash = ?, failed_attempts = 0, is_locked = false, lock_until = NULL WHERE id = ?', [passwordHash, userId]);
  await query('DELETE FROM blacklisted_tokens WHERE user_id = ?', [userId]);
}

async function blacklistToken(token) {
  await query('INSERT INTO blacklisted_tokens (token) VALUES (?)', [token]);
}

async function blacklistUser(userId) {
  // Invalidate all tokens for this user by adding their ID to the blacklist
  await query('INSERT INTO blacklisted_tokens (user_id) VALUES (?)', [userId]);
}

async function isTokenBlacklisted(token) {
  const [rows] = await query('SELECT id FROM blacklisted_tokens WHERE token = ?', [token]);
  return rows.length > 0;
}

async function isUserBlacklisted(userId) {
  // Check if this user's sessions have been invalidated
  const [rows] = await query('SELECT id FROM blacklisted_tokens WHERE user_id = ?', [userId]);
  return rows.length > 0;
}

module.exports = {
  findUserByEmail,
  registerUser,
  verifyPassword,
  incrementFailedAttempts,
  resetFailedAttempts,
  unlockAccount,
  generateAccessToken,
  setOTP,
  verifyOTP,
  resetUserPassword,
  blacklistToken,
  blacklistUser,
  isTokenBlacklisted,
  isUserBlacklisted,
  updateLastLogin,
};
