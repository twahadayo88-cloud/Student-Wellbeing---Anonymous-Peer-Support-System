const { query } = require('../../config/db.config');
const contentSafety = require('../../services/contentSafety.service');

/**
 * Prompt 2 — Mood & Wellbeing Tracker Service
 * ============================================
 * Constraints:
 *  - No crisis-trigger logic of any kind.
 *  - Free-text filtered for profanity before storage ONLY — no alert to any user/role.
 *  - Aggregated trends are Admin/Super Admin only.
 */
class MoodService {
  /**
   * Submit a once-per-day mood check-in.
   * If the user already checked in today, returns alreadyCheckedIn=true without inserting.
   */
  async submitCheckIn(userId, moodScore, rawNote) {
    // One check-in per calendar day
    const [existing] = await query(
      'SELECT id FROM mood_entries WHERE user_id = ? AND DATE(created_at) = CURDATE()',
      [userId]
    );
    if (existing.length > 0) {
      return { id: existing[0].id, alreadyCheckedIn: true };
    }

    let finalNote = rawNote ? rawNote.trim() : null;

    // Profanity filter — storage only, no alerting of any kind
    if (finalNote) {
      const safetyResult = await contentSafety.analyzeContent(finalNote);
      if (safetyResult.isFlagged) {
        safetyResult.matchedTerms.forEach(term => {
          if (!term.startsWith('ai_flag_')) {
            const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Masking must match detection semantics (substring match), not word
            // boundaries — e.g. "shitty" is detected via "shit" but missed by \bshit\b.
            const regex = new RegExp(escapedTerm, 'gi');
            finalNote = finalNote.replace(regex, '***');
          }
        });
      }
    }

    // Column is `notes` in the mood_entries table (not `note`)
    const [result] = await query(
      'INSERT INTO mood_entries (user_id, mood_score, notes) VALUES (?, ?, ?)',
      [userId, moodScore, finalNote]
    );
    const insertId = result.insertId;

    // Pattern detection for consecutive low entries (✅ kept per plan).
    // LOW mood = score 1 or 2. NO alert, NO notification — personal tracking only.
    // counselor_alerted is intentionally never set (crisis-trigger removed).
    if (moodScore <= 2) {
      // Find most recent prior entry to chain the count
      const [prior] = await query(
        `SELECT consecutive_low_count FROM mood_entries
         WHERE user_id = ? AND id != ?
         ORDER BY created_at DESC LIMIT 1`,
        [userId, insertId]
      );
      const priorLowCount = prior.length > 0 ? (prior[0].consecutive_low_count || 0) : 0;
      const newCount = priorLowCount + 1;
      await query(
        'UPDATE mood_entries SET consecutive_low_count = ? WHERE id = ?',
        [newCount, insertId]
      );
    } else {
      // Score >= 3 resets the streak
      await query(
        'UPDATE mood_entries SET consecutive_low_count = 0 WHERE id = ?',
        [insertId]
      );
    }

    return { id: insertId, alreadyCheckedIn: false };
  }

  /**
   * Fetch a student's own mood history (default: last 30 days).
   * Returns consecutive_low_count per entry so the student can see their own pattern.
   * This value is NEVER sent to faculty or admins.
   */
  async getHistory(userId, days = 30) {
    const [rows] = await query(
      `SELECT id, mood_score, notes, consecutive_low_count, created_at
       FROM mood_entries
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       ORDER BY created_at ASC`,
      [userId, days]
    );
    return rows;
  }

  /**
   * 7-day daily average for personal trend chart.
   */
  async getTrendSummary(userId) {
    const [rows] = await query(
      `SELECT DATE(created_at) as date, AVG(mood_score) as avg_score
       FROM mood_entries
       WHERE user_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [userId]
    );
    return rows;
  }

  /**
   * Check whether the student needs an in-app reminder.
   * Returns { needsReminder: bool, missedDays: number }.
   * NEVER sends push/SMS/email — in-app nudge only.
   */
  async getReminderStatus(userId, threshold = 2) {
    const [rows] = await query(
      `SELECT MAX(created_at) as last_checkin,
              MAX(DATE(created_at) = CURDATE()) as checked_in_today
       FROM mood_entries WHERE user_id = ?`,
      [userId]
    );
    const lastCheckin = rows[0]?.last_checkin;
    if (!lastCheckin) {
      return { needsReminder: true, missedDays: null, checkedInToday: false };
    }
    const diffMs = Date.now() - new Date(lastCheckin).getTime();
    const missedDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    return {
      needsReminder: missedDays >= threshold,
      missedDays,
      checkedInToday: Boolean(rows[0].checked_in_today)
    };
  }

  /**
   * Aggregated, fully anonymised department-level trends.
   * Caller MUST be Admin or Super Admin — enforced by both route middleware
   * and the controller. Individual user data is never exposed here.
   */
  async getAggregatedTrendsByDepartment() {
    const [rows] = await query(
      `SELECT p.department, DATE(m.created_at) as date, AVG(m.mood_score) as avg_score,
              COUNT(m.id) as check_in_count
      FROM mood_entries m
      JOIN profiles p ON m.user_id = p.user_id
      JOIN users u ON u.id = m.user_id AND u.role = 'student'
       WHERE m.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
       GROUP BY p.department, DATE(m.created_at)
       ORDER BY p.department ASC, date ASC`
    );

    const trends = {};
    rows.forEach(row => {
      if (!trends[row.department]) {
        trends[row.department] = [];
      }
      trends[row.department].push({
        date: row.date,
        avg_score: Number(row.avg_score),
        check_in_count: row.check_in_count
      });
    });

    return trends;
  }
}

module.exports = new MoodService();
