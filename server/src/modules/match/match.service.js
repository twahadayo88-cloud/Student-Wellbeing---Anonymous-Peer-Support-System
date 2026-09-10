const { query } = require('../../config/db.config');
const safeParse = require('../../utils/safeParse');

async function getRecommendations(userId) {
  const [meRows] = await query('SELECT p.*, u.role FROM profiles p JOIN users u ON p.user_id = u.id WHERE p.user_id = ?', [userId]);
  const me = meRows[0];
  
  // Safe exit if profile doesn't exist – prevents downstream property access crashes
  if (!me) return [];

  const mySubjects = safeParse(me.subjects);
  const mySkills = safeParse(me.skills);

  const [candidates] = await query(`
    SELECT p.*, u.role, bt.current_tier as badge_tier
    FROM profiles p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN badge_tiers bt ON p.user_id = bt.user_id
    WHERE u.role = 'student' 
      AND p.user_id != ?
      AND (u.deletion_scheduled_at IS NULL OR u.deletion_scheduled_at > NOW())
      AND p.trust_score > 30
  `, [userId]);

  const scored = candidates.map(c => {
    let score = 0;
    const cSubjects = safeParse(c.subjects);
    const cSkills = safeParse(c.skills);
    
    const subjMatches = mySubjects.filter(s => cSubjects.includes(s)).length;
    score += subjMatches * 5;

    const skillMatches = mySkills.filter(s => cSkills.includes(s)).length;
    score += skillMatches * 3;

    const badgeTier = c.badge_tier || 'bronze';

    if (me.semester && c.semester && me.semester === c.semester) score += 2;
    if (me.department && c.department && me.department === c.department) score += 2;
    
    // Badge tier weighting
    if (badgeTier === 'platinum') score += 15;
    else if (badgeTier === 'gold') score += 10;
    else if (badgeTier === 'silver') score += 5;

    if (c.trust_score > 70) score += 10;

    return {
      anonymous_id: c.anonymous_id,
      subjects: cSubjects,
      skills: cSkills,
      department: c.department || '',
      semester: c.semester || null,
      badge_tier: badgeTier,
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

async function getFacultyFallback() {
  const [faculty] = await query(`
    SELECT p.name, p.department, p.designation, p.subjects, p.office_hours, p.anonymous_id 
    FROM profiles p
    JOIN users u ON p.user_id = u.id
    WHERE (u.role = 'faculty' OR u.role = 'admin')
      AND (u.deletion_scheduled_at IS NULL OR u.deletion_scheduled_at > NOW())
  `);

  return faculty.map(f => ({
    name: f.name || 'Anonymous Faculty',
    department: f.department || '',
    designation: f.designation || '',
    subjects: safeParse(f.subjects),
    office_hours: safeParse(f.office_hours),
    anonymous_id: f.anonymous_id
  }));
}

async function getPendingRequests(userId) {
  // Auto-expire requests before fetching
  await query('UPDATE chat_requests SET status = "expired" WHERE status = "pending" AND expires_at < NOW()');

  const [incoming] = await query(`
    SELECT r.id, r.subject_context, r.status, r.created_at, p.anonymous_id as sender_anonymous_id
    FROM chat_requests r
    JOIN profiles p ON r.sender_id = p.user_id
    WHERE r.receiver_id = ? AND r.status = 'pending'
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
  getFacultyFallback,
  getPendingRequests
};
