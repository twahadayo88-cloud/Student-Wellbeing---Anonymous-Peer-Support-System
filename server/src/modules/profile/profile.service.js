/**
 * PeerBridge — Profile Service
 * ============================
 * Database layer for the Smart User Profile System.
 *
 * Privacy architecture:
 *   - users table  = real identity (email, password_hash) — NEVER exposed via API
 *   - profiles table = anonymous identity (anonymous_id) — public-facing
 *   - Mapping is user_id ↔ anonymous_id (backend-only)
 *
 * Key rules:
 *   1. behavior_score is fetched but NEVER returned to any API consumer
 *   2. anonymous_id is immutable after creation
 *   3. Deletion is soft (72-hour GDPR delay)
 */

const { query } = require('../../config/db.config');
const safeParse = require('../../utils/safeParse');
const logger = require('../../utils/logger');

/**
 * Fetch a profile by user ID.
 * Returns all fields needed by the controller (trust_score, consent fields, etc.).
 * The controller strips behavior_score before returning to client.
 *
 * @param {number} userId
 * @returns {object|null} Profile data or null
 */
async function getProfileByUserId(userId) {
  const [rows] = await query(`
    SELECT 
      p.user_id, p.anonymous_id,
      p.name, p.designation, p.department,
      p.bio, p.semester, p.subjects, p.skills,
      p.office_hours, p.profile_photo_url,
      p.trust_score,
      p.consent_data_collection, p.consent_mood_tracking, p.consent_ai_analysis,
      p.onboarding_complete, p.is_first_login,
      bt.current_tier as badge_tier,
      u.role,
      u.deletion_scheduled_at
    FROM profiles p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN badge_tiers bt ON p.user_id = bt.user_id
    WHERE p.user_id = ?
      AND (u.deletion_scheduled_at IS NULL OR u.deletion_scheduled_at > NOW())
  `, [userId]);

  return formatProfileRecord(rows[0]);
}

/**
 * Fetch a public profile by anonymous ID.
 *
 * @param {string} anonymousId
 * @returns {object|null} Profile data or null
 */
async function getProfileByAnonymousId(anonymousId) {
  const [rows] = await query(`
    SELECT
      p.anonymous_id,
      p.name,
      p.department,
      p.designation,
      p.semester,
      p.skills,
      p.subjects,
      p.office_hours,
      bt.current_tier as badge_tier,
      u.role
    FROM profiles p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN badge_tiers bt ON p.user_id = bt.user_id
    WHERE p.anonymous_id = ?
      AND u.deletion_scheduled_at IS NULL
  `, [anonymousId]);

  return formatProfileRecord(rows[0]);
}


/**
 * Format raw MySQL record safely.
 */
function formatProfileRecord(profile) {
  if (!profile) return null;

  profile.skills = safeParse(profile.skills);
  profile.subjects = safeParse(profile.subjects);
  profile.office_hours = safeParse(profile.office_hours);

  // Normalise boolean fields (MySQL returns 0/1)
  if (profile.consent_mood_tracking !== undefined) {
    profile.consent_mood_tracking = !!profile.consent_mood_tracking;
  }
  if (profile.consent_data_collection !== undefined) {
    profile.consent_data_collection = !!profile.consent_data_collection;
  }
  if (profile.consent_ai_analysis !== undefined) {
    profile.consent_ai_analysis = !!profile.consent_ai_analysis;
  }
  if (profile.onboarding_required !== undefined) {
    profile.onboarding_required = !!profile.onboarding_required;
  }
  if (profile.is_first_login !== undefined) {
    profile.is_first_login = !!profile.is_first_login;
  }
  // Fix trust score badge display bug:
  if (profile.badge_tier === null || profile.badge_tier === undefined) {
    const score = profile.trust_score ?? 50;
    if (score >= 80) profile.badge_tier = 'platinum';
    else if (score >= 60) profile.badge_tier = 'gold';
    else if (score >= 40) profile.badge_tier = 'silver';
    else profile.badge_tier = 'bronze';
  }

  return profile;
}

/**
 * Lookup anonymous_id for a given user ID.
 * Used by the auth module to return anonymous_id on login.
 *
 * @param {number} userId
 * @returns {string|null}
 */
async function getAnonymousIdByUserId(userId) {
  const [rows] = await query(
    'SELECT anonymous_id FROM profiles WHERE user_id = ?',
    [userId]
  );
  return rows[0]?.anonymous_id || null;
}

/**
 * Update profile fields.
 * Only updates fields that are explicitly provided (non-undefined).
 * Protected fields (anonymous_id, behavior_score) are blocked at the validation layer.
 *
 * @param {number} userId
 * @param {object} updates - Validated update payload
 * @param {string} role    - User role for faculty-field gating
 */
async function updateProfile(userId, updates, role) {
  const { name, skills, department, designation, semester, subjects, office_hours, bio } = updates;
  const isFaculty = ['faculty', 'admin', 'super_admin'].includes(role);

  // Build dynamic SET clause — only include provided fields
  const setClauses = [];
  const params = [];

  const safetyService = require('../safety/safety.service');
  const AppError = require('../../utils/AppError');

  if (bio !== undefined) {
    if (bio.trim().length > 0) {
      const result = await safetyService.monitorContent(bio, 'profile', userId);
      if (result.severity === 'HIGH') {
        throw new AppError('Profile update blocked: harmful language detected', 400);
      } else if (result.severity === 'MEDIUM') {
        await safetyService.addToModerationQueue('profile', userId, bio, userId, 'MEDIUM', result.reason);
      }
    }
    setClauses.push('bio = ?');
    params.push(bio);
  }

  if (skills !== undefined) {
    setClauses.push('skills = ?');
    params.push(JSON.stringify(skills));
  }
  if (department !== undefined) {
    setClauses.push('department = ?');
    params.push(department);
  }
  if (subjects !== undefined) {
    setClauses.push('subjects = ?');
    params.push(JSON.stringify(subjects));
  }
  if (semester !== undefined) {
    setClauses.push('semester = ?');
    params.push(semester);
  }

  if (isFaculty) {
    if (name !== undefined) {
      setClauses.push('name = ?');
      params.push(name);
    }
    if (designation !== undefined) {
      setClauses.push('designation = ?');
      params.push(designation);
    }
    if (office_hours !== undefined) {
      setClauses.push('office_hours = ?');
      params.push(JSON.stringify(office_hours));
    }
  }

  if (updates.is_first_login !== undefined) {
    setClauses.push('is_first_login = ?');
    params.push(updates.is_first_login ? 1 : 0);
  }

  // Update profiles table (if there's anything to update)
  if (setClauses.length > 0) {
    params.push(userId);
    await query(
      `UPDATE profiles SET ${setClauses.join(', ')} WHERE user_id = ?`,
      params
    );
  }
}

/**
 * Update mood tracking consent flag.
 * Dedicated function for the PATCH /consent endpoint.
 *
 * @param {number}  userId
 * @param {object} updates
 */
async function updateConsent(userId, updates) {
  // BUG-023 FIX: Use logger instead of console.log
  logger.info('Updating consent for user', { userId });

  // Build dynamic SET from whatever consent fields are provided
  const allowed = ['consent_data_collection', 'consent_mood_tracking', 'consent_ai_analysis'];
  const fields = Object.keys(updates).filter(k => allowed.includes(k));

  if (fields.length === 0) {
    throw new Error('No valid consent fields provided');
  }

  const setClauses = fields.map(f => `${f} = ?`).join(', ');
  const values = fields.map(f => updates[f] ? 1 : 0);
  values.push(userId);

  await query(`UPDATE profiles SET ${setClauses} WHERE user_id = ?`, values);
}

/**
 * GDPR-compliant account deletion.
 * Marks both users and profiles tables for delayed deletion (72 hours).
 * A scheduled worker/CRON job should hard-delete records past their deadline.
 *
 * @param {number} userId
 */
async function deleteUserAccount(userId) {
  // Mark users table
  await query(
    'UPDATE users SET deletion_scheduled_at = DATE_ADD(NOW(), INTERVAL 72 HOUR) WHERE id = ?',
    [userId]
  );

  // Mark profiles table
  await query(
    'UPDATE profiles SET deletion_scheduled_at = DATE_ADD(NOW(), INTERVAL 72 HOUR) WHERE user_id = ?',
    [userId]
  );
}

/**
 * Cancel a pending account deletion.
 *
 * @param {number} userId
 */
async function cancelDeletion(userId) {
  await query('UPDATE users SET deletion_scheduled_at = NULL, deletion_warning_sent_at = NULL WHERE id = ?', [userId]);
  await query('UPDATE profiles SET deletion_scheduled_at = NULL WHERE user_id = ?', [userId]);
}

/**
 * Mark onboarding as true and save all form data atomically.
 */
async function completeOnboarding(userId, data) {
  logger.info("Completing onboarding for:", { userId });
  try {
    const {
      department,
      semester,
      subjects,
      consent_data_collection,
      consent_mood_tracking,
      consent_ai_analysis,
    } = data;
    
    await query(
      `UPDATE profiles 
       SET is_first_login = FALSE, 
           onboarding_complete = TRUE,
           department = ?,
           semester = ?,
           subjects = ?,
           consent_data_collection = ?,
           consent_mood_tracking = ?,
           consent_ai_analysis = ?
       WHERE user_id = ?`,
      [
        department, 
        semester, 
        JSON.stringify(subjects || []), 
        consent_data_collection ? 1 : 0,
        consent_mood_tracking ? 1 : 0,
        consent_ai_analysis ? 1 : 0,
        userId
      ]
    );
  } catch (err) {
    logger.error("Failed to complete onboarding", { error: err.message, userId });
    throw err;
  }
}

/**
 * Remove sensitive fields for student-to-student views.
 */
function sanitizeProfileForStudent(profile, requestingUserId) {
  if (!profile) return null;
  const sanitized = { ...profile };

  // Calculate badge_tier fallback before deleting trust_score
  if (sanitized.badge_tier === null || sanitized.badge_tier === undefined) {
    const score = profile.trust_score ?? 50;
    if (score >= 80) sanitized.badge_tier = 'platinum';
    else if (score >= 60) sanitized.badge_tier = 'gold';
    else if (score >= 40) sanitized.badge_tier = 'silver';
    else sanitized.badge_tier = 'bronze';
  }

  // 1. Never expose behavior_score (handled at service/controller level already, but belt-and-suspenders)
  delete sanitized.behavior_score;

  // 2. Hide trust_score from students entirely (privacy rule)
  delete sanitized.trust_score;
  
  if (profile.user_id !== requestingUserId) {
    delete sanitized.user_id; // Keep identity anonymous
  }

  return sanitized;
}

module.exports = {
  getProfileByUserId,
  getProfileByAnonymousId,
  getAnonymousIdByUserId,
  updateProfile,
  updateConsent,
  deleteUserAccount,
  cancelDeletion,
  completeOnboarding,
  sanitizeProfileForStudent,
};
