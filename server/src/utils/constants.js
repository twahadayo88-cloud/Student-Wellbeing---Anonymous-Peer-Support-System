/**
 * PeerBridge — Constants & Enums
 * ==============================
 * Central location for all magic strings, role definitions,
 * and shared constants. Import from here — never hardcode.
 */

/**
 * User roles — hierarchical access levels.
 */
const ROLES = Object.freeze({
  STUDENT: 'student',
  FACULTY: 'faculty',
  COUNSELOR_ADMIN: 'counselor_admin',
  DEPT_ADMIN: 'dept_admin',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
});

/**
 * All valid roles as an array (useful for validation).
 */
const ROLE_LIST = Object.freeze(Object.values(ROLES));

/**
 * Role hierarchy — higher index = more privileged.
 * Used by authorisation middleware to check minimum role level.
 */
const ROLE_HIERARCHY = Object.freeze({
  [ROLES.STUDENT]: 0,
  [ROLES.FACULTY]: 1,
  [ROLES.COUNSELOR_ADMIN]: 2,
  [ROLES.DEPT_ADMIN]: 3,
  [ROLES.ADMIN]: 4,
  [ROLES.SUPER_ADMIN]: 5,
});

/**
 * Account status values.
 */
const ACCOUNT_STATUS = Object.freeze({
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  SUSPENDED: 'suspended',
  PENDING: 'pending',
});

/**
 * Audit log action types — used with logger.audit().
 */
const AUDIT_ACTIONS = Object.freeze({
  USER_REGISTER: 'USER_REGISTER',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGOUT: 'USER_LOGOUT',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET_COMPLETE: 'PASSWORD_RESET_COMPLETE',
  PROFILE_FETCH: 'PROFILE_FETCH',
  PROFILE_UPDATE: 'PROFILE_UPDATE',
  CONSENT_CHANGE: 'CONSENT_CHANGE',
  ACCOUNT_DELETION_SCHEDULED: 'ACCOUNT_DELETION_SCHEDULED',
  DATA_EXPORT: 'DATA_EXPORT',
  DATA_DELETE: 'DATA_DELETE',
  DATA_RESTORE: 'DATA_RESTORE',
  MESSAGE_SENT: 'MESSAGE_SENT',
  MESSAGE_FLAGGED: 'MESSAGE_FLAGGED',
  SOS_TRIGGERED: 'SOS_TRIGGERED',
  SOS_RESOLVED: 'SOS_RESOLVED',
  MOOD_RECORDED: 'MOOD_RECORDED',
  ADMIN_ACTION: 'ADMIN_ACTION',
});

/**
 * HTTP status codes — named references for readability.
 */
const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
});

module.exports = {
  ROLES,
  ROLE_LIST,
  ROLE_HIERARCHY,
  ACCOUNT_STATUS,
  AUDIT_ACTIONS,
  HTTP_STATUS,
};
