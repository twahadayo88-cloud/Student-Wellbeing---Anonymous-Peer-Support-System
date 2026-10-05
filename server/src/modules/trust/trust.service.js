const { query } = require('../../config/db.config');
const logger = require('../../utils/logger');
const { getIO } = require('../../config/socket.config');

const TRUST_SCORE_EVENTS = {
  // Increases
  HELPED_SUCCESSFULLY: { amount: +10, reason: 'Helped a peer successfully' },
  RECEIVED_5_STAR: { amount: +5, reason: 'Received 5-star rating' },
  RECEIVED_4_STAR: { amount: +3, reason: 'Received 4-star rating' },
  QUICK_RESPONSE: { amount: +3, reason: 'Responded within 5 minutes' },
  HELPED_CRITICAL: { amount: +15, reason: 'Helped with critical urgency request' },
  CONSISTENT_HELPER: { amount: +5, reason: 'Helped 5+ people this week' },

  // Decreases
  WARNING_RECEIVED: { amount: -2, reason: 'Safety warning received' },
  CONTENT_REMOVED: { amount: -4, reason: 'Content removed by moderator' },
  SUSPENSION: { amount: -6, reason: 'Account suspended for violation' },
  UNRESPONSIVE: { amount: -2, reason: 'Did not respond to matched request' },
  NEGATIVE_FEEDBACK: { amount: -3, reason: 'Received negative feedback' }
};

/**
 * Trust Service — Handles reputation, badges, and rankings.
 */
class TrustService {
  /**
   * Main entry point for triggering score changes
   */
  async handleTrustEvent(userId, eventType) {
    const event = TRUST_SCORE_EVENTS[eventType];
    if (!event) return;
    const componentOnlyEvents = ['HELPED_SUCCESSFULLY', 'RECEIVED_5_STAR', 'RECEIVED_4_STAR'];
    if (componentOnlyEvents.includes(eventType)) return;

    if (['WARNING_RECEIVED', 'CONTENT_REMOVED', 'SUSPENSION'].includes(eventType)) {
      await query(`
        INSERT INTO trust_score_components (user_id, violation_count)
        VALUES (?, 1)
        ON DUPLICATE KEY UPDATE violation_count = violation_count + 1
      `, [userId]);
    } else {
      await query(`
        INSERT INTO trust_score_components (user_id, event_adjustment)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE event_adjustment = GREATEST(-20, LEAST(20, event_adjustment + VALUES(event_adjustment)))
      `, [userId, event.amount]);
    }
    await this.recalculateTrustScore(userId, event.reason);
  }

  async updateBadgeTier(userId, newScore) {
    let newTier = 'bronze';
    if (newScore >= 80) newTier = 'platinum';
    else if (newScore >= 60) newTier = 'gold';
    else if (newScore >= 40) newTier = 'silver';

    const [current] = await query('SELECT current_tier FROM badge_tiers WHERE user_id = ?', [userId]);
    const oldTier = current.length ? current[0].current_tier : 'bronze';

    if (!current.length || oldTier !== newTier) {
      await query(`
        INSERT INTO badge_tiers (user_id, current_tier, previous_tier, tier_achieved_at)
        VALUES (?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          previous_tier = current_tier,
          current_tier = ?,
          tier_achieved_at = NOW()
      `, [userId, newTier, current.length ? oldTier : null, newTier]);

      // Notify user via Socket
      const io = getIO();
      if (io) {
        const [userProfile] = await query('SELECT anonymous_id FROM profiles WHERE user_id = ?', [userId]);
        const anonId = userProfile[0]?.anonymous_id;
        if (anonId) {
          io.to(anonId).emit('badge:tier_upgraded', {
            previous_tier: oldTier,
            new_tier: newTier,
            message: `Congratulations! You reached ${newTier.toUpperCase()} tier!`
          });
        }
      }
      logger.info(`User ${userId} upgraded to ${newTier} tier`);
    }
  }

  async recalculateTrustScore(userId) {
    await query('INSERT IGNORE INTO trust_score_components (user_id) VALUES (?)', [userId]);
    const [[components]] = await query('SELECT * FROM trust_score_components WHERE user_id = ?', [userId]);
    const [[activity]] = await query(`
      SELECT COUNT(*) AS resolution_count,
             AVG(TIMESTAMPDIFF(MINUTE, created_at, matched_at)) AS avg_response_time_minutes
      FROM academic_requests
      WHERE matched_helper_id = ? AND status = 'resolved' AND matched_at IS NOT NULL
    `, [userId]);
    const [[rating]] = await query(
      'SELECT AVG(rating) AS avg_rating, COUNT(*) AS rating_count FROM feedback WHERE to_user = ?',
      [userId]
    );
    const [[violations]] = await query(
      'SELECT COUNT(*) AS count FROM violation_history WHERE user_id = ?',
      [userId]
    );
    const [[profile]] = await query('SELECT trust_score, anonymous_id FROM profiles WHERE user_id = ?', [userId]);
    if (!profile) return;

    const componentRatingCount = Number(components.total_ratings_received || 0);
    const feedbackRatingCount = Number(rating.rating_count || 0);
    const ratingCount = componentRatingCount + feedbackRatingCount;
    const helpfulnessRating = ratingCount > 0
      ? ((Number(components.helpfulness_rating || 0) * componentRatingCount) +
         (Number(rating.avg_rating || 0) * feedbackRatingCount)) / ratingCount
      : 3;
    const resolutionCount = Math.max(Number(components.resolution_count || 0), Number(activity.resolution_count || 0));
    const violationCount = Math.max(Number(components.violation_count || 0), Number(violations.count || 0));
    const avgResponse = activity.avg_response_time_minutes === null || activity.avg_response_time_minutes === undefined
      ? null
      : Number(activity.avg_response_time_minutes);

    // 50-point starting score; remaining weights: helpfulness 20, resolutions 20,
    // response time 10, and violations up to a 30-point penalty.
    const helpfulnessDelta = Math.round((helpfulnessRating - 3) * 10);
    const resolutionScore = Math.min(resolutionCount * 2, 20);
    const violationPenalty = Math.min(violationCount * 10, 30);
    let responseScore = 0;
    if (avgResponse !== null && avgResponse <= 5) responseScore = 10;
    else if (avgResponse !== null && avgResponse <= 15) responseScore = 8;
    else if (avgResponse !== null && avgResponse <= 30) responseScore = 6;
    else if (avgResponse !== null && avgResponse <= 60) responseScore = 4;
    else if (avgResponse !== null && avgResponse <= 120) responseScore = 2;

    const finalScore = Math.max(0, Math.min(100, Math.round(
      50 + helpfulnessDelta + resolutionScore + responseScore - violationPenalty + Number(components.event_adjustment || 0)
    )));
    const oldScore = Number(profile.trust_score ?? 50);

    await query(`
      UPDATE trust_score_components
      SET resolution_count = ?, avg_response_time_minutes = ?, last_calculated = NOW()
      WHERE user_id = ?
    `, [resolutionCount, avgResponse, userId]);

    if (oldScore !== finalScore) {
      await query('UPDATE profiles SET trust_score = ? WHERE user_id = ?', [finalScore, userId]);
      await query(`
        INSERT INTO trust_score_history (user_id, old_score, new_score, change_amount, change_reason, change_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [userId, oldScore, finalScore, finalScore - oldScore, 'Weighted 24-hour recalculation', finalScore > oldScore ? 'increase' : 'decrease']);
      await this.updateBadgeTier(userId, finalScore);
      const io = getIO();
      if (io && profile.anonymous_id) {
        io.to(profile.anonymous_id).emit('trust:score_changed', { badge_tier: this.getBadgeTier(finalScore) });
        io.to('admin_room').emit('trust:score_updated', { user_id: userId, badge_tier: this.getBadgeTier(finalScore) });
      }
      logger.info(`Trust score recalculated for user ${userId}: ${oldScore} -> ${finalScore}`);
    } else {
      await this.updateBadgeTier(userId, finalScore);
    }
  }

  getBadgeTier(score) {
    if (score >= 80) return 'platinum';
    if (score >= 60) return 'gold';
    if (score >= 40) return 'silver';
    return 'bronze';
  }

  async updateMonthlyLeaderboard() {
    const monthYear = new Date().toISOString().slice(0, 7); // YYYY-MM

    const [helpers] = await query(`
      SELECT 
        u.id as user_id,
        p.anonymous_id,
        COALESCE(p.department, 'Unassigned') AS department,
        p.trust_score,
        COUNT(ar.id) as help_count,
        COALESCE(AVG(f.rating), 0) as avg_rating
      FROM users u
      JOIN profiles p ON u.id = p.user_id
      LEFT JOIN academic_requests ar ON ar.matched_helper_id = u.id
        AND ar.status = 'resolved'
        AND DATE_FORMAT(ar.resolved_at, '%Y-%m') = ?
      LEFT JOIN feedback f ON f.to_user = u.id
        AND DATE_FORMAT(f.created_at, '%Y-%m') = ?
      WHERE u.role = 'student'
        AND (u.deletion_scheduled_at IS NULL OR u.deletion_scheduled_at > NOW())
      GROUP BY u.id, p.anonymous_id, p.department, p.trust_score
      HAVING help_count > 0
      ORDER BY p.department, help_count DESC, avg_rating DESC
    `, [monthYear, monthYear]);

    let currentDept = null;
    let rank = 0;

    for (const helper of helpers) {
      if (helper.department !== currentDept) {
        currentDept = helper.department;
        rank = 0;
      }
      rank++;

      await query(`
        INSERT INTO monthly_leaderboard
          (user_id, anonymous_id, department, month_year, help_count, avg_rating, trust_score, rank_position)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE
          help_count = VALUES(help_count),
          avg_rating = VALUES(avg_rating),
          trust_score = VALUES(trust_score),
          rank_position = VALUES(rank_position)
      `, [helper.user_id, helper.anonymous_id, helper.department,
          monthYear, helper.help_count, helper.avg_rating,
          helper.trust_score, rank]);
    }

    const io = getIO();
    if (io) {
      io.emit('leaderboard:updated', { month_year: monthYear });
    }
  }

  async getLeaderboard(department = null) {
    const monthYear = new Date().toISOString().slice(0, 7);
    let sql = 'SELECT * FROM monthly_leaderboard WHERE month_year = ?';
    const params = [monthYear];

    if (department) {
      sql += ' AND department = ?';
      params.push(department);
    }

    sql += ' ORDER BY rank_position ASC LIMIT 100';
    const [rows] = await query(sql, params);

    // If monthly leaderboard table is empty (cron hasn't run yet), fallback to a live query
    if (rows.length === 0) {
      let liveSql = `
        SELECT 
          p.anonymous_id,
          COALESCE(p.department, 'Unassigned') AS department,
          p.trust_score,
          COUNT(ar.id) as help_count,
          COALESCE(AVG(f.rating), 0) as avg_rating,
          ROW_NUMBER() OVER (${department ? 'ORDER BY COUNT(ar.id) DESC, AVG(f.rating) DESC' : 'PARTITION BY p.department ORDER BY COUNT(ar.id) DESC, AVG(f.rating) DESC'}) as rank_position
        FROM users u
        JOIN profiles p ON u.id = p.user_id
        LEFT JOIN academic_requests ar ON ar.matched_helper_id = u.id AND ar.status = 'resolved'
        LEFT JOIN feedback f ON f.to_user = u.id
        WHERE u.role = 'student'
          AND (u.deletion_scheduled_at IS NULL OR u.deletion_scheduled_at > NOW())
      `;
      const liveParams = [];
      if (department) {
        liveSql += ' AND p.department = ?';
        liveParams.push(department);
      }
      liveSql += ` GROUP BY u.id, p.anonymous_id, p.department, p.trust_score
        HAVING help_count > 0
        ORDER BY ${department ? '' : 'p.department, '}help_count DESC, avg_rating DESC
        LIMIT 100`;
      const [liveRows] = await query(liveSql, liveParams);
      // Assign rank_position manually per dept
      const deptRanks = {};
      return liveRows.map(row => {
        const dept = row.department;
        deptRanks[dept] = (deptRanks[dept] || 0) + 1;
        const { trust_score: score, ...publicRow } = row;
        delete publicRow.user_id;
        return { ...publicRow, badge_tier: this.getBadgeTier(Number(score ?? 50)), rank_position: deptRanks[dept] };
      });
    }

    return rows.map(row => {
      const { trust_score: score, ...publicRow } = row;
      delete publicRow.user_id;
      return { ...publicRow, badge_tier: this.getBadgeTier(Number(score ?? 50)) };
    });
  }

  async getUserBadge(userId) {
    const [rows] = await query(`
      SELECT bt.current_tier, bt.tier_achieved_at,
        CASE
          WHEN p.trust_score >= 80 THEN 'platinum'
          WHEN p.trust_score >= 60 THEN 'gold'
          WHEN p.trust_score >= 40 THEN 'silver'
          ELSE 'bronze'
        END AS calculated_tier
      FROM profiles p
      LEFT JOIN badge_tiers bt ON p.user_id = bt.user_id
      WHERE p.user_id = ?
    `, [userId]);

    if (!rows.length) return { current_tier: 'bronze' };
    
    return {
      current_tier: rows[0].current_tier || rows[0].calculated_tier || 'bronze',
      tier_achieved_at: rows[0].tier_achieved_at
    };
  }

  async getTrustHistory(userId) {
    const [rows] = await query(
      'SELECT * FROM trust_score_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
      [userId]
    );
    return rows;
  }
}

module.exports = new TrustService();
