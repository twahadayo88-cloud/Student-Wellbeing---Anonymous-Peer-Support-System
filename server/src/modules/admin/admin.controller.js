const adminService = require('./admin.service');
const { HTTP_STATUS } = require('../../utils/constants');
const AppError = require('../../utils/AppError');
const contentSafety = require('../../services/contentSafety.service');
const asyncHandler = require('../../utils/asyncHandler');

/**
 * AdminController — handles HTTP requests for admin operations.
 */
class AdminController {
  getUsers = async (req, res, next) => {
    try {
      const users = await adminService.getAllUsers();
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: users
      });
    } catch (error) {
      next(error);
    }
  };

  getViolations = async (req, res, next) => {
    try {
      const violations = await adminService.getViolations();
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: violations
      });
    } catch (error) {
      next(error);
    }
  };

  getAuditLogs = async (req, res, next) => {
    try {
      const logs = await adminService.getAuditLogs();
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: logs
      });
    } catch (error) {
      next(error);
    }
  };

  getStats = async (req, res, next) => {
    try {
      const stats = await adminService.getPlatformStats();
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  };

  updateRole = async (req, res, next) => {
    try {
      const { id } = req.params;
      const { role } = req.body;
      
      if (!role) {
        throw new AppError('Role is required', HTTP_STATUS.BAD_REQUEST);
      }

      await adminService.updateUserRole(id, role, req.user.id);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: `User role updated to ${role}`
      });
    } catch (error) {
      next(error);
    }
  };

  unlockUser = async (req, res, next) => {
    try {
      const { id } = req.params;
      const authService = require('../auth/auth.service');
      await authService.unlockAccount(id);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'Account unlocked successfully'
      });
    } catch (error) {
      next(error);
    }
  };

  getRepeatOffenders = asyncHandler(async (_req, res) => {
    const data = await adminService.getRepeatOffenders();
    res.status(HTTP_STATUS.OK).json({ success: true, data });
  });

  getSecuritySignals = asyncHandler(async (_req, res) => {
    const data = await adminService.getSecuritySignals();
    res.status(HTTP_STATUS.OK).json({ success: true, data });
  });

  getPendingAppeals = asyncHandler(async (_req, res) => {
    const data = await adminService.getPendingNoticeAppeals();
    res.status(HTTP_STATUS.OK).json({ success: true, data });
  });

  reviewAppeal = asyncHandler(async (req, res) => {
    const appealId = Number(req.params.id);
    if (!Number.isSafeInteger(appealId) || appealId < 1) throw AppError.badRequest('Invalid appeal ID.');
    const { decision } = req.body;
    const note = typeof req.body.note === 'string' ? req.body.note.trim() : '';
    if (note.length > 1000) throw AppError.badRequest('Review note must be 1000 characters or fewer.');
    await adminService.reviewNoticeAppeal(appealId, req.user.user_id, decision, note);
    res.status(HTTP_STATUS.OK).json({ success: true, message: `Appeal ${decision === 'publish' ? 'approved' : 'rejected'}.` });
  });

  getModerationRules = asyncHandler(async (_req, res) => {
    const data = await adminService.getModerationRules();
    res.status(HTTP_STATUS.OK).json({ success: true, data });
  });

  createModerationRule = asyncHandler(async (req, res) => {
    const term = typeof req.body.term === 'string' ? req.body.term.trim().toLowerCase() : '';
    const severity = typeof req.body.severity === 'string' ? req.body.severity.toUpperCase() : '';
    if (term.length < 2 || term.length > 120 || term.startsWith('ai_flag_')) {
      throw AppError.badRequest('Rule term must be 2 to 120 characters.');
    }
    if (!['MEDIUM', 'HIGH'].includes(severity)) throw AppError.badRequest('Severity must be MEDIUM or HIGH.');
    const id = await adminService.createModerationRule(term, severity, req.user.user_id);
    contentSafety.invalidateModerationRulesCache();
    res.status(HTTP_STATUS.CREATED).json({ success: true, data: { id } });
  });

  updateModerationRule = asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw AppError.badRequest('Invalid rule ID.');
    const updates = {};
    if (req.body.term !== undefined) {
      if (typeof req.body.term !== 'string') throw AppError.badRequest('Rule term must be text.');
      updates.term = req.body.term.trim().toLowerCase();
      if (updates.term.length < 2 || updates.term.length > 120 || updates.term.startsWith('ai_flag_')) {
        throw AppError.badRequest('Rule term must be 2 to 120 characters.');
      }
    }
    if (req.body.severity !== undefined) {
      updates.severity = String(req.body.severity).toUpperCase();
      if (!['MEDIUM', 'HIGH'].includes(updates.severity)) throw AppError.badRequest('Severity must be MEDIUM or HIGH.');
    }
    if (req.body.enabled !== undefined) {
      if (typeof req.body.enabled !== 'boolean') throw AppError.badRequest('Enabled must be boolean.');
      updates.enabled = req.body.enabled;
    }
    await adminService.updateModerationRule(id, updates, req.user.user_id);
    contentSafety.invalidateModerationRulesCache();
    res.status(HTTP_STATUS.OK).json({ success: true });
  });

  deleteModerationRule = asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) throw AppError.badRequest('Invalid rule ID.');
    await adminService.deleteModerationRule(id, req.user.user_id);
    contentSafety.invalidateModerationRulesCache();
    res.status(HTTP_STATUS.OK).json({ success: true });
  });

  getPolicyReviews = asyncHandler(async (_req, res) => {
    const data = await adminService.getPolicyReviews();
    res.status(HTTP_STATUS.OK).json({ success: true, data });
  });

  recordPolicyReview = asyncHandler(async (req, res) => {
    const summary = typeof req.body.summary === 'string' ? req.body.summary.trim() : '';
    if (summary.length < 20 || summary.length > 5000) {
      throw AppError.badRequest('Policy review must be 20 to 5000 characters.');
    }
    await adminService.recordPolicyReview(req.user.user_id, summary);
    res.status(HTTP_STATUS.CREATED).json({ success: true });
  });
}

module.exports = new AdminController();
