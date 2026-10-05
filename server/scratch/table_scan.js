/* Scratch: quick DB health scan — checks which tables referenced by code exist. */
const { query, pool } = require('../src/config/db.config');

const required = [
  'users', 'profiles', 'anonymous_id_map', 'chat_requests', 'chat_messages', 'chat_offer_exclusions',
  'blocks', 'reports', 'broadcasts', 'feedback', 'helper_feedback', 'academic_requests',
  'helper_listings', 'mood_entries', 'resources', 'resource_reviews', 'resource_bookmarks',
  'notice_posts', 'notice_post_reports', 'notice_reactions', 'notice_saves', 'notice_appeals',
  'complaints', 'complaint_history', 'moderation_queue', 'moderation_rules', 'notifications',
  'trust_scores', 'trust_score_history', 'trust_score_components', 'badge_tiers',
  'monthly_leaderboard', 'violation_history', 'audit_logs', 'blacklisted_tokens',
  'scheduled_tasks', 'anonymous_id_history', 'policy_reviews', 'security_events',
];

(async () => {
  let missing = [];
  for (const t of required) {
    try { await query(`SELECT 1 FROM ${t} LIMIT 1`); }
    catch { missing.push(t); }
  }
  console.log(missing.length ? 'MISSING TABLES: ' + missing.join(', ') : 'All required tables exist.');
  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
