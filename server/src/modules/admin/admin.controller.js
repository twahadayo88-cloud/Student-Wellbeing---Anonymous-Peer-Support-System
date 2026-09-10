const adminService = require('./admin.service');
const { HTTP_STATUS } = require('../../utils/constants');
const AppError = require('../../utils/AppError');

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

  getSOSRecords = async (req, res, next) => {
    try {
      const records = await adminService.getSOSRecords();
      res.status(HTTP_STATUS.OK).json({
        success: true,
        data: records
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

  resolveSOS = async (req, res, next) => {
    try {
      const { id } = req.params;
      await adminService.resolveSOSRecord(id, req.user.id);
      
      res.status(HTTP_STATUS.OK).json({
        success: true,
        message: 'SOS record resolved and follow-up scheduled'
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
}

module.exports = new AdminController();
