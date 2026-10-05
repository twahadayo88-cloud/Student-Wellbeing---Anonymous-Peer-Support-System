const { query } = require('../../config/db.config');
const logger = require('../../utils/logger');
const { AUDIT_ACTIONS } = require('../../utils/constants');
const AppError = require('../../utils/AppError');

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
        p.anonymous_id, p.department, bt.current_tier AS badge_tier
      FROM users u
      LEFT JOIN profiles p ON u.id = p.user_id
      LEFT JOIN badge_tiers bt ON bt.user_id = u.id
      ORDER BY u.id DESC
    `);
    return users;
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
      const [violationRows] = await query('SELECT COUNT(*) as total FROM violation_history');

      const [activeRows] = await query(`
        SELECT COUNT(*) as total FROM users 
        WHERE last_login >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);

      const stats = {
        total_users: totalRows[0]?.total || 0,
        active_today: activeRows[0]?.total || 0,
        total_violations: violationRows[0]?.total || 0
      };

      logger.info('Platform stats aggregated', stats);
      return stats;
    } catch (err) {
      logger.error('Failed to get platform stats', { error: err.message });
      return { total_users: 0, active_today: 0, total_violations: 0 };
    }
  }

  async getRepeatOffenders() {
    const [rows] = await query(`
      SELECT v.user_id, p.anonymous_id, p.behavior_score,
             COUNT(*) AS violation_count,
             SUM(v.severity = 'HIGH') AS high_severity_count,
             MAX(v.created_at) AS last_violation_at
      FROM violation_history v
      JOIN profiles p ON p.user_id = v.user_id
      WHERE v.created_at >= DATE_SUB(NOW(), INTERVAL 90 DAY)
      GROUP BY v.user_id, p.anonymous_id, p.behavior_score
      HAVING COUNT(*) >= 3
      ORDER BY high_severity_count DESC, violation_count DESC, last_violation_at DESC
      LIMIT 100
    `);
    return rows;
  }

  async getSecuritySignals() {
    const [accounts] = await query(`
      SELECT u.id AS user_id, u.email, u.failed_attempts, u.is_locked, u.lock_until,
             p.anonymous_id
      FROM users u
      LEFT JOIN profiles p ON p.user_id = u.id
      WHERE u.is_locked = 1 OR u.failed_attempts >= 3
      ORDER BY u.is_locked DESC, u.failed_attempts DESC
      LIMIT 100
    `);
    const [highSeverity] = await query(`
      SELECT COUNT(*) AS count
      FROM violation_history
      WHERE severity = 'HIGH' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);
    const [[accountCounts]] = await query(`
      SELECT COUNT(*) AS requiring_review,
             SUM(is_locked = 1) AS locked_accounts
      FROM users
      WHERE is_locked = 1 OR failed_attempts >= 3
    `);
    return {
      accounts_requiring_review: accounts,
      accounts_requiring_review_count: Number(accountCounts?.requiring_review || 0),
      locked_account_count: Number(accountCounts?.locked_accounts || 0),
      high_severity_violations_24h: Number(highSeverity[0]?.count || 0),
    };
  }

  async getPendingNoticeAppeals() {
    const [rows] = await query(`
      SELECT a.id, a.post_id, a.reason, a.created_at,
             p.title, p.body, p.category, p.severity, pr.anonymous_id
      FROM notice_appeals a
      JOIN notice_posts p ON p.id = a.post_id
      LEFT JOIN profiles pr ON pr.user_id = a.user_id
      WHERE a.status = 'pending'
      ORDER BY a.created_at ASC
    `);
    return rows;
  }

  async reviewNoticeAppeal(appealId, adminId, decision, note) {
    if (!['publish', 'reject'].includes(decision)) {
      throw AppError.badRequest('Decision must be publish or reject.');
    }
    const [rows] = await query(
      "SELECT post_id FROM notice_appeals WHERE id = ? AND status = 'pending'",
      [appealId]
    );
    if (!rows.length) throw AppError.notFound('Pending appeal not found.');
    await require('../notices/notices.service').reviewPost(rows[0].post_id, adminId, decision, note);
  }

  async getModerationRules() {
    const [rows] = await query(
      'SELECT id, term, severity, enabled, created_at, updated_at FROM moderation_rules ORDER BY term ASC'
    );
    return rows;
  }

  async createModerationRule(term, severity, adminId) {
    const [result] = await query(
      'INSERT INTO moderation_rules (term, severity, created_by, updated_by) VALUES (?, ?, ?, ?)',
      [term, severity, adminId, adminId]
    );
    logger.audit(AUDIT_ACTIONS.ADMIN_ACTION, {
      admin_id: adminId,
      action: 'MODERATION_RULE_CREATED',
      details: { rule_id: result.insertId, term, severity },
    });
    return result.insertId;
  }

  async updateModerationRule(ruleId, updates, adminId) {
    const [rows] = await query('SELECT id, term, severity, enabled FROM moderation_rules WHERE id = ?', [ruleId]);
    if (!rows.length) throw AppError.notFound('Moderation rule not found.');
    const term = updates.term === undefined ? rows[0].term : updates.term;
    const severity = updates.severity === undefined ? rows[0].severity : updates.severity;
    const enabled = updates.enabled === undefined ? rows[0].enabled : updates.enabled;
    await query(
      'UPDATE moderation_rules SET term = ?, severity = ?, enabled = ?, updated_by = ? WHERE id = ?',
      [term, severity, enabled ? 1 : 0, adminId, ruleId]
    );
    logger.audit(AUDIT_ACTIONS.ADMIN_ACTION, {
      admin_id: adminId,
      action: 'MODERATION_RULE_UPDATED',
      details: { rule_id: ruleId, term, severity, enabled: Boolean(enabled) },
    });
  }

  async deleteModerationRule(ruleId, adminId) {
    const [result] = await query('DELETE FROM moderation_rules WHERE id = ?', [ruleId]);
    if (!result.affectedRows) throw AppError.notFound('Moderation rule not found.');
    logger.audit(AUDIT_ACTIONS.ADMIN_ACTION, {
      admin_id: adminId,
      action: 'MODERATION_RULE_DELETED',
      details: { rule_id: ruleId },
    });
  }

  async getPolicyReviews() {
    const [rows] = await query(`
      SELECT r.id, r.review_week, r.summary, r.completed_at, u.email AS reviewer_email
      FROM policy_reviews r
      LEFT JOIN users u ON u.id = r.reviewer_id
      ORDER BY r.review_week DESC LIMIT 26
    `);
    return rows;
  }

  async recordPolicyReview(adminId, summary) {
    const [result] = await query(`
      INSERT INTO policy_reviews (review_week, reviewer_id, summary)
      VALUES (DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY), ?, ?)
      ON DUPLICATE KEY UPDATE reviewer_id = VALUES(reviewer_id), summary = VALUES(summary), completed_at = NOW()
    `, [adminId, summary]);
    logger.audit(AUDIT_ACTIONS.ADMIN_ACTION, {
      admin_id: adminId,
      action: 'WEEKLY_POLICY_REVIEW_RECORDED',
      details: { summary },
    });
    return result;
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

}

module.exports = new AdminService();