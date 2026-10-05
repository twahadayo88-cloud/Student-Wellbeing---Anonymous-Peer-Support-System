/**
 * PeerBridge — Profile Input Validation
 * ======================================
 * Centralised validation for profile update and consent endpoints.
 * Enforces string lengths, array sizes, type checks, and ensures
 * protected fields (anonymous_id, behavior_score) are never writable.
 */

const AppError = require('../../utils/AppError');

/**
 * Maximum allowed values — tune as needed.
 */
const LIMITS = Object.freeze({
  MAX_SKILLS: 10,
  MAX_SKILL_LENGTH: 50,
  MAX_SUBJECTS: 10,
  MAX_SUBJECT_LENGTH: 50,
  MAX_DEPARTMENT_LENGTH: 100,
  MAX_DESIGNATION_LENGTH: 100,
  MAX_OFFICE_HOURS_LENGTH: 500, // JSON string length safe margin
});

/**
 * Validate profile update payload.
 * Throws AppError on any violation.
 *
 * @param {object} body   - req.body from the request
 * @param {string} role   - User role (student | faculty | admin)
 */
function validateProfileUpdate(body, role) {
  const errors = [];
  const isFaculty = ['faculty', 'admin', 'super_admin'].includes(role);

  // ─── Protected Field Guards ─────────────────────────
  if (body.anonymous_id !== undefined) {
    throw AppError.forbidden('Cannot modify anonymous_id');
  }
  if (body.behavior_score !== undefined) {
    throw AppError.forbidden('Cannot modify behavior_score');
  }

  // ─── Faculty-Only Guards ────────────────────────────
  if (!isFaculty) {
    if (body.name !== undefined || body.designation !== undefined || body.office_hours !== undefined) {
      throw AppError.forbidden('Only faculty can update name, designation, and office_hours');
    }
  }

  // ─── Name Validation (Faculty) ──────────────────────
  if (body.name !== undefined) {
    if (typeof body.name !== 'string') {
      errors.push('name must be a string');
    } else if (body.name.length > 255) {
      errors.push('name must be ≤ 255 characters');
    }
  }

  // ─── Designation (Faculty) ──────────────────────────
  if (body.designation !== undefined) {
    if (typeof body.designation !== 'string') {
      errors.push('designation must be a string');
    } else if (body.designation.length > LIMITS.MAX_DESIGNATION_LENGTH) {
      errors.push(`designation must be ≤ ${LIMITS.MAX_DESIGNATION_LENGTH} characters`);
    }
  }

  // ─── Office Hours (Faculty) ─────────────────────────
  if (body.office_hours !== undefined) {
    if (!Array.isArray(body.office_hours)) {
      errors.push('office_hours must be an array of objects');
    }
  }

  // ─── Shared/Common Fields (Student + Faculty) ───────

  // Department
  if (body.department !== undefined) {
    if (typeof body.department !== 'string') {
      errors.push('department must be a string');
    } else if (body.department.length > LIMITS.MAX_DEPARTMENT_LENGTH) {
      errors.push(`department must be ≤ ${LIMITS.MAX_DEPARTMENT_LENGTH} characters`);
    }
  }

  // Bio
  if (body.bio !== undefined) {
    if (typeof body.bio !== 'string') {
      errors.push('bio must be a string');
    } else if (body.bio.length > 500) {
      errors.push('bio must be ≤ 500 characters');
    }
  }

  // Semester (Mostly student, but safely checked)
  if (body.semester !== undefined && body.semester !== null) {
    if (typeof body.semester !== 'number' || body.semester < 1 || body.semester > 20) {
      errors.push('semester must be a valid number between 1 and 20');
    }
  }

  // Skills
  if (body.skills !== undefined) {
    if (!Array.isArray(body.skills)) {
      errors.push('skills must be an array');
    } else {
      if (body.skills.length > LIMITS.MAX_SKILLS) {
        errors.push(`skills cannot exceed ${LIMITS.MAX_SKILLS} items`);
      }
      for (const skill of body.skills) {
        if (typeof skill !== 'string' || skill.trim().length === 0) {
          errors.push('Skills must be non-empty strings');
          break;
        }
        if (skill.length > LIMITS.MAX_SKILL_LENGTH) {
          errors.push(`Each skill must be ≤ ${LIMITS.MAX_SKILL_LENGTH} characters`);
          break;
        }
      }
    }
  }

  // Subjects
  if (body.subjects !== undefined) {
    if (!Array.isArray(body.subjects)) {
      errors.push('subjects must be an array');
    } else {
      if (body.subjects.length > LIMITS.MAX_SUBJECTS) {
        errors.push(`subjects cannot exceed ${LIMITS.MAX_SUBJECTS} items`);
      }
      for (const subject of body.subjects) {
        if (typeof subject !== 'string' || subject.trim().length === 0) {
          errors.push('Subjects must be non-empty strings');
          break;
        }
        if (subject.length > LIMITS.MAX_SUBJECT_LENGTH) {
          errors.push(`Each subject must be ≤ ${LIMITS.MAX_SUBJECT_LENGTH} characters`);
          break;
        }
      }
    }
  }

  // ─── is_first_login Validation ──────────────────────
  if (body.is_first_login !== undefined) {
    if (typeof body.is_first_login !== 'boolean') {
      errors.push('is_first_login must be a boolean');
    }
  }

  if (errors.length > 0) {
    throw AppError.badRequest('Validation failed', errors);
  }
}

/**
 * Validate consent update payload.
 * Throws AppError on any violation.
 *
 * @param {object} body - req.body
 */
function validateConsentUpdate(body) {
  const fields = ['consent_mood_tracking', 'consent_data_collection', 'consent_ai_analysis'];
  
  for (const field of fields) {
    if (body[field] !== undefined && typeof body[field] !== 'boolean') {
      throw AppError.badRequest(`${field} must be a boolean`);
    }
  }
}

module.exports = {
  validateProfileUpdate,
  validateConsentUpdate,
  LIMITS,
};
