/**
 * PeerBridge — Auth Controller
 * =============================
 * Handles registration, login, and logout.
 *
 * PRIVACY RULES:
 *   - Login response NEVER returns email or user.id
 *   - Only anonymous_id + role + token are sent to client
 *   - Register response confirms success without leaking identity
 */

const asyncHandler = require('../../utils/asyncHandler');
const { HTTP_STATUS, AUDIT_ACTIONS } = require('../../utils/constants');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const { validateRegister, validateLogin } = require('./auth.validation');
const authService = require('./auth.service');
const profileService = require('../profile/profile.service');
const { sendOTPEmail } = require('../../utils/email');
const crypto = require('crypto');

const register = asyncHandler(async (req, res) => {
  const { isValid, errors } = validateRegister(req.body);
  if (!isValid) {
    throw AppError.badRequest('Validation failed', errors);
  }

  const { email, password } = req.body;

  const existingUser = await authService.findUserByEmail(email.toLowerCase());
  if (existingUser) {
    throw AppError.conflict('Email already registered');
  }

  const newUser = await authService.registerUser(email, password);

  logger.audit(AUDIT_ACTIONS.USER_REGISTER, {
    userId: newUser.id,
    role: newUser.role,
    ip: req.ip,
    // NOTE: email intentionally NOT logged in audit for privacy
  });

  // PRIVACY: Never return email or internal user id
  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: 'Account created successfully. Your anonymous identity has been generated.',
    data: {
      anonymous_id: newUser.anonymous_id,
      role: newUser.role,
    },
  });
});

const login = asyncHandler(async (req, res) => {
  const { isValid, errors } = validateLogin(req.body);
  if (!isValid) {
    throw AppError.badRequest('Validation failed', errors);
  }

  const { email, password } = req.body;
  const sanitizedEmail = email.toLowerCase();

  const user = await authService.findUserByEmail(sanitizedEmail);
  if (!user) {
    logger.audit(AUDIT_ACTIONS.USER_LOGIN_FAILED, {
      reason: 'user not found',
      ip: req.ip,
      // NOTE: email intentionally NOT logged
    });
    // Generic error to avoid data enumeration attacks (OWASP)
    throw AppError.unauthorized('Invalid email or password');
  }

  // Check account lock status
  if (user.is_locked) {
    const now = new Date();
    if (user.lock_until && new Date(user.lock_until) > now) {
      logger.audit(AUDIT_ACTIONS.USER_LOGIN_FAILED, {
        userId: user.id,
        reason: 'account locked',
        ip: req.ip,
      });
      throw AppError.unauthorized('Account is locked due to too many failed attempts. Please try again later.');
    } else {
      // Lock timestamp expired, reset counters before validating new attempt
      await authService.unlockAccount(user.id);
    }
  }

  // Check if account is pending GDPR deletion
  if (user.deletion_scheduled_at) {
    throw AppError.unauthorized('This account is scheduled for deletion and cannot be accessed.');
  }

  const isPasswordValid = await authService.verifyPassword(password, user.password_hash);

  if (!isPasswordValid) {
    const isNowLocked = await authService.incrementFailedAttempts(user.id);
    logger.audit(AUDIT_ACTIONS.USER_LOGIN_FAILED, {
      userId: user.id,
      reason: 'invalid password',
      ip: req.ip,
    });

    if (isNowLocked) {
      logger.audit(AUDIT_ACTIONS.ADMIN_ACTION, {
        action: 'ACCOUNT_LOCKED',
        userId: user.id,
        ip: req.ip,
      });
      throw AppError.unauthorized('Invalid email or password. Maximum attempts reached, account locked for 30 minutes.');
    }

    throw AppError.unauthorized('Invalid email or password');
  }

  // Reset counters immediately on successful password verification
  await authService.resetFailedAttempts(user.id);
  
  // Update last login timestamp
  await authService.updateLastLogin(user.id);

  // Fetch identity mappings from profiles table
  const fullProfile = await profileService.getProfileByUserId(user.id);

  const token = authService.generateAccessToken({
    user_id: user.id,
    role: user.role,
  });

  logger.audit(AUDIT_ACTIONS.USER_LOGIN, {
    userId: user.id,
    role: user.role,
    ip: req.ip,
    // NOTE: email intentionally NOT logged in audit for privacy
  });

  // PRIVACY: Never return email or internal user id to client
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Login successful',
    data: {
      token,
      user: {
        anonymous_id: fullProfile ? fullProfile.anonymous_id : 'UNKNOWN',
        role: user.role,
        onboarding_required: fullProfile?.is_first_login ?? false,
      },
    },
  });
});

const logout = asyncHandler(async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (token) {
    await authService.blacklistToken(token);
  }

  logger.audit(AUDIT_ACTIONS.USER_LOGOUT, { 
    userId: req.user?.user_id,
    ip: req.ip 
  });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Logged out successfully',
  });
});

const forgotPassword = asyncHandler(async (req, res) => {
  const { email } = req.body;
  const user = await authService.findUserByEmail(email);
  
  if (!user) {
    // Return success even if email not found to prevent user enumeration
    return res.status(HTTP_STATUS.OK).json({
      success: true,
      message: 'If an account exists, a reset code has been sent.',
    });
  }

  const otp = crypto.randomInt(100000, 999999).toString();
  await authService.setOTP(user.id, otp);
  
  await sendOTPEmail(user.email, otp);

  logger.audit(AUDIT_ACTIONS.PASSWORD_RESET_REQUEST, { userId: user.id, ip: req.ip });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'If an account exists, a reset code has been sent.',
  });
});

const verifyOTP = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;
  const user = await authService.findUserByEmail(email);

  if (!user) {
    throw AppError.unauthorized('Invalid attempt');
  }

  const result = await authService.verifyOTP(user.id, otp);
  
  if (result.locked) {
    throw AppError.unauthorized('Account locked for 15 minutes due to too many failed OTP attempts.');
  }

  if (!result.valid) {
    throw AppError.unauthorized('Invalid or expired code');
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Code verified successfully',
  });
});

const resetPassword = asyncHandler(async (req, res) => {
  const { email, newPassword } = req.body;
  const user = await authService.findUserByEmail(email);

  if (!user) {
    throw AppError.unauthorized('Invalid attempt');
  }

  // Final check: OTP columns must be NULL which means verifyOTP was successful
  if (user.otp_code !== null) {
    throw AppError.badRequest('Must verify code before resetting password');
  }

  await authService.resetUserPassword(user.id, newPassword);
  
  logger.audit(AUDIT_ACTIONS.PASSWORD_RESET_COMPLETE, { userId: user.id, ip: req.ip });

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Password reset successfully. You can now login.',
  });
});

module.exports = { register, login, logout, forgotPassword, verifyOTP, resetPassword };
