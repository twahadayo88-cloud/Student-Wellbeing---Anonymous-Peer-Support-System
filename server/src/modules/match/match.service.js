const { query } = require('../../config/db.config');
const safeParse = require('../../utils/safeParse');

function configuredScore(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) ? value : fallback;
}

const MATCH_WEIGHTS = {
  subject: Math.max(0, configuredScore('MATCH_WEIGHT_SUBJECT', 40)),
  semester: Math.max(0, configuredScore('MATCH_WEIGHT_SEMESTER', 25)),
  trust: Math.max(0, configuredScore('MATCH_WEIGHT_TRUST', 20)),
  activity: Math.max(0, configuredScore('MATCH_WEIGHT_ACTIVITY', 15)),
};
const MIN_TRUST_SCORE = Math.max(0, Math.min(100, configuredScore('MATCH_MIN_TRUST_SCORE', 30)));
const FEEDBACK_CAP = Math.max(0, configuredScore('MATCH_FEEDBACK_MAX', 5));

async function getRecommendations(userId) {
  const [meRows] = await query('SELECT p.*, u.role FROM profiles p JOIN users u ON p.user_id = u.id WHERE p.user_id = ?', [userId]);
  const me = meRows[0];
  
  // Safe exit if profile doesn't exist – prevents downstream property access crashes
  if (!me || me.role !== 'student') return [];

  const mySubjects = safeParse(me.subjects);
  const weightTotal = Object.values(MATCH_WEIGHTS).reduce((total, weight) => total + Math.max(0, weight), 0) || 1;

  const [candidates] = await query(`
    SELECT p.*, u.role, bt.current_tier as badge_tier,
      GREATEST(
        COALESCE(p.updated_at, '1970-01-01'),
        COALESCE((
          SELECT MAX(cm.created_at)
          FROM chat_messages cm
          WHERE cm.sender_id = p.user_id OR cm.receiver_id = p.user_id
        ), '1970-01-01')
      ) AS recent_activity_at
    FROM profiles p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN badge_tiers bt ON p.user_id = bt.user_id
    WHERE u.role = 'student' 
      AND p.user_id != ?
      AND (u.deletion_scheduled_at IS NULL OR u.deletion_scheduled_at > NOW())
      AND p.trust_score >= ?
  `, [userId, MIN_TRUST_SCORE]);

  const feedbackAdjustments = new Map();
  if (candidates.length && FEEDBACK_CAP > 0) {
    const placeholders = candidates.map(() => '?').join(',');
    const [feedbackRows] = await query(`
      SELECT helper_user_id, AVG(rating) AS avg_rating
      FROM helper_feedback
      WHERE helper_user_id IN (${placeholders})
      GROUP BY helper_user_id
    `, candidates.map(candidate => candidate.user_id));
    for (const row of feedbackRows) {
      const rawAdjustment = (Number(row.avg_rating) - 3) * 2;
      feedbackAdjustments.set(
        Number(row.helper_user_id),
        Math.max(-FEEDBACK_CAP, Math.min(FEEDBACK_CAP, rawAdjustment))
      );
    }
  }

  const scored = candidates.map(c => {
    const cSubjects = safeParse(c.subjects);
    const subjectScore = mySubjects.length
      ? Math.min(mySubjects.filter(subject => cSubjects.includes(subject)).length / mySubjects.length, 1)
      : 0;
    const mySemester = Number(me.semester);
    const candidateSemester = Number(c.semester);
    const semesterGap = Number.isFinite(mySemester) && Number.isFinite(candidateSemester)
      ? Math.abs(mySemester - candidateSemester)
      : (me.semester && c.semester && me.semester === c.semester ? 0 : Infinity);
    const semesterScore = semesterGap === 0 ? 1
      : semesterGap === 1 ? 0.75
        : semesterGap === 2 ? 0.5
          : semesterGap === 3 ? 0.25 : 0;
    const trustScore = Math.max(0, Math.min(100, Number(c.trust_score) || 0)) / 100;
    const activityDate = c.recent_activity_at ? new Date(c.recent_activity_at) : null;
    let activityScore = 0;
    if (activityDate && !Number.isNaN(activityDate.getTime())) {
      const ageInDays = (Date.now() - activityDate.getTime()) / (24 * 60 * 60 * 1000);
      if (ageInDays <= 1) activityScore = 1;
      else if (ageInDays <= 7) activityScore = 0.8;
      else if (ageInDays <= 30) activityScore = 0.5;
      else if (ageInDays <= 90) activityScore = 0.2;
    }
    const baseScore = (
      subjectScore * Math.max(0, MATCH_WEIGHTS.subject) +
      semesterScore * Math.max(0, MATCH_WEIGHTS.semester) +
      trustScore * Math.max(0, MATCH_WEIGHTS.trust) +
      activityScore * Math.max(0, MATCH_WEIGHTS.activity)
    ) / weightTotal;
    const score = baseScore + (feedbackAdjustments.get(Number(c.user_id)) || 0) / 100;

    return {
      anonymous_id: c.anonymous_id,
      subjects: cSubjects,
      department: c.department || '',
      semester: c.semester || null,
      badge_tier: c.badge_tier || 'bronze',
      _score: score
    };
  });

  scored.sort((a, b) => b._score - a._score);

  return scored.slice(0, 10).map(c => {
    const final = { ...c };
    delete final._score;
    return final;
  });
}

async function getPendingRequests(userId) {
  // Auto-expire requests before fetching
  await query('UPDATE chat_requests SET status = "expired" WHERE status = "pending" AND expires_at < NOW()');
  await query(`
    UPDATE academic_requests ar
    JOIN chat_requests cr ON cr.academic_request_id = ar.id
    SET ar.status = 'open', ar.matched_helper_id = NULL, ar.matched_at = NULL
    WHERE cr.status = 'expired' AND ar.status = 'matched' AND ar.matched_at IS NULL
  `);

  const [incoming] = await query(`
    SELECT r.id, r.academic_request_id, r.subject_context, r.status, r.created_at, r.expires_at,
      p.anonymous_id as sender_anonymous_id
    FROM chat_requests r
    JOIN profiles p ON r.sender_id = p.user_id
    WHERE r.receiver_id = ?
  `, [userId]);

  const [sent] = await query(`
    SELECT r.id, r.subject_context, r.status, r.created_at, p.anonymous_id as receiver_anonymous_id
    FROM chat_requests r
    JOIN profiles p ON r.receiver_id = p.user_id
    WHERE r.sender_id = ?
  `, [userId]);

  return { incoming, sent };
}

module.exports = {
  getRecommendations,
  getPendingRequests
};
