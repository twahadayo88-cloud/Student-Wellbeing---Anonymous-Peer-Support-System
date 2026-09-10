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
  SOS_SUPPORT_GIVEN: { amount: +8, reason: 'Provided SOS support' },
  CONSISTENT_HELPER: { amount: +5, reason: 'Helped 5+ people this week' },

  // Decreases
  WARNING_RECEIVED: { amount: -2, reason: 'Safety warning received' },
  CONTENT_REMOVED: { amount: -4, reason: 'Content removed by moderator' },
  SUSPENSION: { amount: -6, reason: 'Account suspended for violation' },
  SOS_FALSE_ALARM: { amount: -4, reason: 'SOS false alarm triggered' },
  UNRESPONSIVE: { amount: -2, reason: 'Did not respond to matched request' },
  NEGATIVE_FEEDBACK: { amount: -3, reason: 'Received negative feedback' }
};

const BADGE_TIERS = {
  BRONZE: { min: 0, max: 39, label: 'bronze', description: 'New member' },
  SILVER: { min: 40, max: 59, label: 'silver', description: 'Trusted peer' },
  GOLD: { min: 60, max: 79, label: 'gold', description: 'Reliable helper' },
  PLATINUM: { min: 80, max: 100, label: 'platinum', description: 'Elite contributor' }
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

    const [profile] = await query('SELECT trust_score FROM profiles WHERE user_id = ?', [userId]);
    if (!profile.length) return;

    const oldScore = profile[0].trust_score;
    const newScore = Math.max(0, Math.min(100, oldScore + event.amount));

    if (oldScore === newScore) return;

    // 1. Update Profile
    await query('UPDATE profiles SET trust_score = ? WHERE user_id = ?', [newScore, userId]);

    // 2. Log History
    await query(`
      INSERT INTO trust_score_history (user_id, old_score, new_score, change_amount, change_reason, change_type)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [userId, oldScore, newScore, event.amount, event.reason, event.amount > 0 ? 'increase' : 'decrease']);

    // 3. Update Badge Tier
    await this.updateBadgeTier(userId, newScore);

    // 4. Notify via Socket
    const io = getIO();
    if (io) {
      const [userProfile] = await query('SELECT anonymous_id FROM profiles WHERE user_id = ?', [userId]);
      const anonId = userProfile[0]?.anonymous_id;
      if (anonId) {
        io.to(anonId).emit('trust:score_changed', {
          change_amount: event.amount,
          change_reason: event.reason,
          new_score: newScore,
          trust_score: newScore // Add this for compatibility with profile UI
        });
        
        // Also emit the specific event Profile.jsx listens to
        io.to(anonId).emit('trust_score:updated', { trust_score: newScore });
      }

      // Notify Admins to update user tables
      io.to('admin_room').emit('trust:score_updated', {
        user_id: userId,
        new_score: newScore
      });
    }

    logger.info(`Trust score updated for user ${userId}: ${oldScore} -> ${newScore} (${event.reason})`);
  }

  async updateBadgeTier(userId, newScore) {
    let newTier = 'bronze';
    if (newScore >= 80) newTier = 'platinum';
    else if (newScore >= 60) newTier = 'gold';
    else if (newScore >= 40) newTier = 'silver';

    const [current] = await query('SELECT current_tier FROM badge_tiers WHERE user_id = ?', [userId]);
    const oldTier = current.length ? current[0].current_tier : 'bronze';

    if (oldTier !== newTier) {
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
    const [components] = await query('SELECT * FROM trust_score_components WHERE user_id = ?', [userId]);
    if (!components.length) return;

    const {
      helpfulness_rating,
      resolution_count,
      violation_count,
      avg_response_time_minutes
    } = components[0];

    // Formula Implementation
    const helpfulnessScore = (parseFloat(helpfulness_rating) / 5) * 40;
    const resolutionScore = Math.min(resolution_count * 2, 30);
    const violationPenalty = Math.min(violation_count * 10, 20);
    
    let responseScore = 0;
    if (avg_response_time_minutes <= 5) responseScore = 10;
    else if (avg_response_time_minutes <= 15) responseScore = 8;
    else if (avg_response_time_minutes <= 30) responseScore = 6;
    else if (avg_response_time_minutes <= 60) responseScore = 4;
    else if (avg_response_time_minutes <= 120) responseScore = 2;

    let finalScore = Math.round(helpfulnessScore + resolutionScore + responseScore - violationPenalty);
    finalScore = Math.max(0, Math.min(100, finalScore));

    const [profile] = await query('SELECT trust_score FROM profiles WHERE user_id = ?', [userId]);
    const oldScore = profile[0]?.trust_score || 0;

    if (oldScore !== finalScore) {
      await query('UPDATE profiles SET trust_score = ? WHERE user_id = ?', [finalScore, userId]);
      await this.updateBadgeTier(userId, finalScore);
      
      await query('UPDATE trust_score_components SET last_calculated = NOW() WHERE user_id = ?', [userId]);
    }
  }

  async updateMonthlyLeaderboard() {
    const monthYear = new Date().toISOString().slice(0, 7); // YYYY-MM

    const [helpers] = await query(`
      SELECT 
        u.id as user_id,
        p.anonymous_id,
        p.department,
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
          u.id,
          p.anonymous_id,
          p.department,
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
      let deptRanks = {};
      return liveRows.map(row => {
        const dept = row.department;
        deptRanks[dept] = (deptRanks[dept] || 0) + 1;
        return { ...row, rank_position: deptRanks[dept] };
      });
    }

    return rows;
  }

  async getUserBadge(userId) {
    const [rows] = await query(`
      SELECT bt.*, p.trust_score 
      FROM profiles p
      LEFT JOIN badge_tiers bt ON p.user_id = bt.user_id
      WHERE p.user_id = ?
    `, [userId]);

    if (!rows.length) return { current_tier: 'bronze' };
    
    return {
      current_tier: rows[0].current_tier || 'bronze',
      trust_score: rows[0].trust_score,
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
