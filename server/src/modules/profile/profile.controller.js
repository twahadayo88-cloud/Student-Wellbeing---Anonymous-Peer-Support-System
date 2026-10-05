/**
 * PeerBridge — Profile Controller
 * ================================
 * Handles all profile-related HTTP requests.
 *
 * Privacy rules enforced at this layer:
 *   1. behavior_score is NEVER included in any response
 *   2. Only role-appropriate fields are returned (data minimization)
 *   3. All operations are audit-logged
 *   4. Protected fields are blocked via validation layer
 *
 * Endpoints:
 *   GET    /api/profile/me       → getProfile
 *   PUT    /api/profile/update   → updateProfile
 *   PATCH  /api/profile/consent  → updateConsent
 *   DELETE /api/profile/delete   → deleteAccount
 */

const asyncHandler = require('../../utils/asyncHandler');
const { HTTP_STATUS, AUDIT_ACTIONS } = require('../../utils/constants');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const profileService = require('./profile.service');
const { validateProfileUpdate, validateConsentUpdate } = require('./profile.validation');

/**
 * Build a clean, role-appropriate profile response.
 * Strips behavior_score and internal fields in ALL cases.
 * @param {object} profile - Raw profile from service layer
 * @returns {object} Sanitized profile for API response
 */
function sanitizeProfile(profile) {
  const isFacultyOrAdmin = ['faculty', 'admin', 'super_admin'].includes(profile.role);

  if (isFacultyOrAdmin) {
    // FACULTY / ADMIN RESPONSE CONTRACT
    return {
      anonymous_id: profile.anonymous_id,
      name: profile.name || 'Anonymous Faculty',
      department: profile.department || '',
      designation: profile.designation || '',
      subjects: profile.subjects || [],
      office_hours: profile.office_hours || [],
      skills: profile.skills || [],
      badge_tier: profile.badge_tier || 'bronze',
      bio: profile.bio || '',
      // Meta flags
      role: profile.role,
      consent_mood_tracking: profile.consent_mood_tracking,
      consent_data_collection: profile.consent_data_collection,
      consent_ai_analysis: profile.consent_ai_analysis,
      onboarding_required: profile.is_first_login === true || profile.onboarding_complete !== true
    };
  }

  // STUDENT RESPONSE CONTRACT
  return {
    anonymous_id: profile.anonymous_id,
    skills: profile.skills || [],
    subjects: profile.subjects || [],
    department: profile.department || '',
    semester: profile.semester || null,
    badge_tier: profile.badge_tier || 'bronze',
    bio: profile.bio || '',
    // Meta flags
    role: profile.role,
    consent_mood_tracking: profile.consent_mood_tracking,
    consent_data_collection: profile.consent_data_collection,
    consent_ai_analysis: profile.consent_ai_analysis,
    onboarding_required: profile.is_first_login === true || profile.onboarding_complete !== true
  };
}

// ─── GET /api/profile/me ──────────────────────────────
const getProfile = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;

  const profile = await profileService.getProfileByUserId(userId);

  if (!profile) {
    throw AppError.notFound('Profile not found');
  }

  logger.audit(AUDIT_ACTIONS.PROFILE_FETCH, {
    action: 'FETCH_PROFILE',
    userId,
    anonymousId: profile.anonymous_id,
    ip: req.ip,
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: sanitizeProfile(profile),
  });
});

// ─── GET /api/profile/:anonymous_id ───────────────────
const getPublicProfile = asyncHandler(async (req, res) => {
  const { anonymous_id } = req.params;

  const profile = await profileService.getProfileByAnonymousId(anonymous_id);

  if (!profile) {
    throw AppError.notFound('Profile not found');
  }

  logger.audit(AUDIT_ACTIONS.PROFILE_FETCH, {
    action: 'FETCH_PUBLIC_PROFILE',
    targetAnonymousId: anonymous_id,
    requesterUserId: req.user.user_id,
    ip: req.ip,
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: sanitizeProfile(profile),
  });
});

// ─── PUT /api/profile/update ──────────────────────────
const updateProfile = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const userRole = req.user.role;

  // Validate input (throws on violation)
  validateProfileUpdate(req.body, userRole);

  const { name, skills, department, designation, semester, subjects, office_hours, is_first_login, bio } = req.body;

  await profileService.updateProfile(userId, {
    name,
    skills,
    department,
    designation,
    semester,
    subjects,
    office_hours,
    is_first_login,
    bio,
  }, userRole);

  const updatedProfile = await profileService.getProfileByUserId(userId);

  if (!updatedProfile) {
    throw AppError.notFound('Profile not found after update');
  }

  logger.audit(AUDIT_ACTIONS.PROFILE_UPDATE, {
    action: 'UPDATE_PROFILE',
    userId,
    anonymousId: updatedProfile.anonymous_id,
    updatedFields: Object.keys(req.body).filter(k => req.body[k] !== undefined),
    ip: req.ip,
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Profile updated successfully',
    data: sanitizeProfile(updatedProfile),
  });
});

// ─── PATCH /api/profile/consent ───────────────────────
const updateConsent = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;

  // Validate input (throws on violation)
  validateConsentUpdate(req.body);

  // BUG-006 FIX: pass the entire body object so service can update all 3 consent fields
  await profileService.updateConsent(userId, req.body);

  logger.audit(AUDIT_ACTIONS.CONSENT_CHANGE, {
    action: 'CONSENT_UPDATE',
    userId,
    consent_updates: req.body,
    ip: req.ip,
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Consent settings updated successfully',
    data: req.body,
  });
});

const completeOnboarding = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  
  await profileService.completeOnboarding(userId, req.body);

  logger.audit(AUDIT_ACTIONS.PROFILE_UPDATE, {
    action: 'ONBOARDING_COMPLETE',
    userId,
    ip: req.ip,
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Onboarding completed',
    onboarding_complete: true
  });
});

// ─── DELETE /api/profile/delete ───────────────────────
const deleteAccount = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;

  logger.audit(AUDIT_ACTIONS.ACCOUNT_DELETION_SCHEDULED, {
    action: 'DELETE_ACCOUNT_REQUESTED',
    userId,
    ip: req.ip,
  });

  // GDPR: 72-hour soft-delete holding period
  await profileService.deleteUserAccount(userId);

  logger.audit(AUDIT_ACTIONS.DATA_DELETE, {
    action: 'DELETE_ACCOUNT_SCHEDULED',
    userId,
    scheduledDeletion: '72 hours from now',
    ip: req.ip,
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Account scheduled for deletion. All data will be permanently removed within 72 hours per GDPR standards.',
  });
});

const cancelDeletion = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;

  await profileService.cancelDeletion(userId);

  logger.audit(AUDIT_ACTIONS.DATA_RESTORE, {
    action: 'CANCEL_DELETION',
    userId,
    ip: req.ip,
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Deletion request cancelled. Your account has been restored.',
  });
});

module.exports = { getProfile, getPublicProfile, updateProfile, updateConsent, deleteAccount, cancelDeletion, completeOnboarding };
