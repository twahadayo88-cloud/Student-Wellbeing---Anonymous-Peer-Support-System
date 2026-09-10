const { query } = require('../../config/db.config');
const logger = require('../../utils/logger');
const { AUDIT_ACTIONS } = require('../../utils/constants');

/**
 * AdminService — core administrative logic.
 */
class AdminService {
  /**
   * Get all users with their profile data.
   */
  async getAllUsers() {
    const [users] = await query(`
      SELECT 
        u.id, 
        u.email,
        u.role, u.is_locked, u.created_at,
        p.anonymous_id, p.department, p.trust_score
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      ORDER BY u.id DESC
    `);
    return users;
  }

  /**
   * Get all SOS records with anonymous identity context.
   */
  async getSOSRecords() {
    const [records] = await query(`
    SELECT 
      s.*,
      s.timestamp as created_at,
      p.anonymous_id 
    FROM sos_records s
    JOIN profiles p ON s.student_id = p.user_id
    ORDER BY s.id DESC
  `);
    return records;
  }

  async getViolations() {
    const [violations] = await query(`
      SELECT 
        v.*, 
        p.anonymous_id 
      FROM violation_history v
      JOIN profiles p ON v.user_id = p.user_id
      ORDER BY v.created_at DESC
    `);
    return violations;
  }

  /**
   * Get platform audit logs.
   */
  async getAuditLogs() {
    const [logs] = await query(`
      SELECT 
        a.*, 
        p.anonymous_id 
      FROM audit_logs a
      LEFT JOIN profiles p ON a.user_id = p.user_id
      ORDER BY a.created_at DESC
    `);
    return logs;
  }

  /**
   * Aggregate platform usage statistics.
   */
  async getPlatformStats() {
    try {
      const [totalRows] = await query('SELECT COUNT(*) as total FROM users WHERE role != "super_admin"');
      const [sosRows] = await query('SELECT COUNT(*) as total FROM sos_records WHERE status IN ("pending", "in_progress")');
      const [violationRows] = await query('SELECT COUNT(*) as total FROM violation_history');

      const [activeRows] = await query(`
        SELECT COUNT(*) as total FROM users 
        WHERE last_login >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);

      const stats = {
        total_users: totalRows[0]?.total || 0,
        active_today: activeRows[0]?.total || 0,
        active_sos: sosRows[0]?.total || 0,
        total_violations: violationRows[0]?.total || 0
      };

      logger.info('Platform stats aggregated', stats);
      return stats;
    } catch (err) {
      logger.error('Failed to get platform stats', { error: err.message });
      return { total_users: 0, active_today: 0, active_sos: 0, total_violations: 0 };
    }
  }

  /**
   * Update a user's role.
   */
  async updateUserRole(userId, newRole, adminId) {
    await query('UPDATE users SET role = ? WHERE id = ?', [newRole, userId]);

    logger.audit(AUDIT_ACTIONS.ADMIN_ACTION, {
      admin_id: adminId,
      target_user_id: userId,
      action: 'UPDATE_ROLE',
      new_role: newRole
    });

    return true;
  }

  /**
   * Resolve an SOS record and schedule a follow-up check-in.
   */
  async resolveSOSRecord(sosId, adminId) {
    await query('UPDATE sos_records SET status = "resolved" WHERE id = ?', [sosId]);

    const [[record]] = await query('SELECT student_id FROM sos_records WHERE id = ?', [sosId]);

    if (record) {
      await query(`
        INSERT INTO scheduled_tasks (user_id, task_type, execute_at, payload)
        VALUES (?, 'wellness_checkin', DATE_ADD(NOW(), INTERVAL 1 DAY), ?)
      `, [record.student_id, JSON.stringify({ original_sos_id: sosId, counselor_id: adminId })]);
    }

    logger.audit(AUDIT_ACTIONS.SOS_RESOLVED, {
      sos_id: sosId,
      resolved_by: adminId
    });

    return true;
  }
}

module.exports = new AdminService();