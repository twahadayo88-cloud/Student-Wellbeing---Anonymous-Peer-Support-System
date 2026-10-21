const { query, pool } = require('../../config/db.config');
const AppError = require('../../utils/AppError');
const contentSafety = require('../../services/contentSafety.service');
const { getMoodSubjectId } = require('./moodIdentity');

const MIN_AGGREGATE_PARTICIPANTS = 5;

async function assertMoodConsent(userId) {
  const [rows] = await query(
    `SELECT u.role, p.consent_mood_tracking
     FROM users u
     JOIN profiles p ON p.user_id = u.id
     WHERE u.id = ?`,
    [userId]
  );
  if (!rows.length || rows[0].role !== 'student') {
    throw AppError.forbidden('Mood tracking is available to students only.');
  }
  if (!rows[0].consent_mood_tracking) {
    throw AppError.forbidden('Enable mood-tracking consent before using mood features.');
  }
}

class MoodService {
  async getRecommendationContext(userId) {
    const [profiles] = await query(
      `SELECT u.role, p.consent_mood_tracking
       FROM users u
       JOIN profiles p ON p.user_id = u.id
       WHERE u.id = ?`,
      [userId]
    );
    if (!profiles.length || profiles[0].role !== 'student') {
      throw AppError.forbidden('Mood-based recommendations are available to students only.');
    }
    if (!profiles[0].consent_mood_tracking) {
      return { consented: false, mood_score: null };
    }

    const [moods] = await query(
      `SELECT mood_score FROM mood_entries
       WHERE mood_subject_id = ?
       ORDER BY created_at DESC LIMIT 1`,
      [getMoodSubjectId(userId)]
    );
    return {
      consented: true,
      mood_score: moods.length ? Number(moods[0].mood_score) : null,
    };
  }

  async submitCheckIn(userId, moodScore, rawNote) {
    await assertMoodConsent(userId);
    const moodSubjectId = getMoodSubjectId(userId);

    let finalNote = typeof rawNote === 'string' ? rawNote.trim() || null : null;
    if (finalNote) {
      const safetyResult = await contentSafety.analyzeContent(finalNote);
      if (safetyResult.isFlagged) {
        for (const term of safetyResult.matchedTerms) {
          if (!term.startsWith('ai_flag_')) {
            const escapedTerm = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            finalNote = finalNote.replace(new RegExp(escapedTerm, 'gi'), '***');
          }
        }
      }
    }

    const connection = await pool.getConnection();
    const lockName = `mood:${moodSubjectId.slice(0, 58)}`;
    let lockAcquired = false;
    try {
      const [lockRows] = await connection.execute('SELECT GET_LOCK(?, 5) AS acquired', [lockName]);
      lockAcquired = Number(lockRows[0]?.acquired) === 1;
      if (!lockAcquired) {
        throw new AppError('Unable to safely reserve today’s mood check-in. Please try again.', 503);
      }

      const [existing] = await connection.execute(
        'SELECT id FROM mood_entries WHERE mood_subject_id = ? AND DATE(created_at) = CURDATE() LIMIT 1',
        [moodSubjectId]
      );
      if (existing.length) {
        return { id: existing[0].id, alreadyCheckedIn: true };
      }

      const [profileRows] = await connection.execute(
        `SELECT p.department
         FROM profiles p JOIN users u ON u.id = p.user_id
         WHERE p.user_id = ? AND u.role = 'student' AND p.consent_mood_tracking = 1`,
        [userId]
      );
      if (!profileRows.length) {
        throw AppError.forbidden('Mood-tracking consent is required.');
      }

      const [prior] = await connection.execute(
        `SELECT consecutive_low_count FROM mood_entries
         WHERE mood_subject_id = ?
         ORDER BY created_at DESC LIMIT 1`,
        [moodSubjectId]
      );
      const consecutiveLowCount = moodScore <= 2
        ? Number(prior[0]?.consecutive_low_count || 0) + 1
        : 0;

      const [result] = await connection.execute(
        `INSERT INTO mood_entries
           (mood_subject_id, department, mood_score, notes, consecutive_low_count)
         VALUES (?, ?, ?, ?, ?)`,
        [moodSubjectId, profileRows[0].department || null, moodScore, finalNote, consecutiveLowCount]
      );
      return { id: result.insertId, alreadyCheckedIn: false };
    } finally {
      try {
        if (lockAcquired) {
          await connection.execute('SELECT RELEASE_LOCK(?)', [lockName]);
        }
      } finally {
        connection.release();
      }
    }
  }

  async getHistory(userId, days = 30) {
    await assertMoodConsent(userId);
    const [rows] = await query(
      `SELECT id, mood_score, notes, consecutive_low_count, created_at
       FROM mood_entries
       WHERE mood_subject_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
       ORDER BY created_at ASC`,
      [getMoodSubjectId(userId), days]
    );
    return rows;
  }

  async getTrendSummary(userId) {
    await assertMoodConsent(userId);
    const [rows] = await query(
      `SELECT DATE(created_at) AS date, AVG(mood_score) AS avg_score
       FROM mood_entries
       WHERE mood_subject_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
       GROUP BY DATE(created_at)
       ORDER BY date ASC`,
      [getMoodSubjectId(userId)]
    );
    return rows;
  }

  async getReminderStatus(userId, threshold = 1) {
    await assertMoodConsent(userId);
    const [rows] = await query(
      `SELECT MAX(created_at) AS last_checkin,
              MAX(DATE(created_at) = CURDATE()) AS checked_in_today,
              GREATEST(DATEDIFF(CURDATE(), DATE(MAX(created_at))) - 1, 0) AS missed_days
       FROM mood_entries WHERE mood_subject_id = ?`,
      [getMoodSubjectId(userId)]
    );
    const lastCheckin = rows[0]?.last_checkin;
    if (!lastCheckin) {
      return { needsReminder: true, missedDays: null, checkedInToday: false };
    }
    const missedDays = Number(rows[0].missed_days);
    return {
      needsReminder: missedDays >= threshold,
      missedDays,
      checkedInToday: Boolean(rows[0].checked_in_today)
    };
  }

  async getAggregatedTrendsByDepartment() {
    const [rows] = await query(
      `SELECT department, DATE(created_at) AS date,
              AVG(mood_score) AS avg_score,
              COUNT(*) AS check_in_count,
              COUNT(DISTINCT mood_subject_id) AS participant_count
       FROM mood_entries
       WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
         AND department IS NOT NULL AND department <> ''
       GROUP BY department, DATE(created_at)
       HAVING COUNT(DISTINCT mood_subject_id) >= ?
       ORDER BY department ASC, date ASC`,
      [MIN_AGGREGATE_PARTICIPANTS]
    );

    const trends = {};
    for (const row of rows) {
      if (!trends[row.department]) trends[row.department] = [];
      trends[row.department].push({
        date: row.date,
        avg_score: Number(row.avg_score),
        check_in_count: Number(row.check_in_count),
        participant_count: Number(row.participant_count)
      });
    }
    return trends;
  }
}

module.exports = new MoodService();
