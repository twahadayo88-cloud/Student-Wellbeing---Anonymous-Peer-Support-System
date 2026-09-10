const { query } = require('../src/config/db.config');

async function runChecks() {
  try {
    console.log('--- Feature 1 ---');
    try {
      const [q1a] = await query('DESCRIBE trust_score_components;');
      console.log('trust_score_components exists');
    } catch (e) { console.log('trust_score_components missing:', e.message); }
    try {
      const [q1b] = await query('DESCRIBE trust_score_history;');
      console.log('trust_score_history exists');
    } catch (e) { console.log('trust_score_history missing:', e.message); }
    try {
      const [q1c] = await query('SELECT user_id, trust_score FROM profiles ORDER BY trust_score DESC LIMIT 5;');
      console.log('profiles trust_score:', q1c);
    } catch (e) { console.log('profiles trust_score error:', e.message); }

    console.log('--- Feature 5 ---');
    try {
      const [q5] = await query("SELECT * FROM trust_score_history WHERE change_type = 'decrease' ORDER BY id DESC LIMIT 5;");
      console.log('trust_score_history decreases:', q5);
    } catch (e) { console.log('trust_score_history decreases error:', e.message); }

    console.log('--- Feature 6 ---');
    try {
      const [q6] = await query('DESCRIBE badge_tiers;');
      console.log('badge_tiers exists');
    } catch (e) { console.log('badge_tiers missing:', e.message); }

    console.log('--- Feature 8 ---');
    try {
      const [q8a] = await query('DESCRIBE monthly_leaderboard;');
      console.log('monthly_leaderboard exists');
    } catch (e) { console.log('monthly_leaderboard missing:', e.message); }
    try {
      const [q8b] = await query("SELECT * FROM monthly_leaderboard WHERE month_year = DATE_FORMAT(NOW(), '%Y-%m') LIMIT 5;");
      console.log('monthly_leaderboard data:', q8b);
    } catch (e) { console.log('monthly_leaderboard data error:', e.message); }
    
  } catch (err) {
    console.error('DB Error:', err.message);
  } finally {
    process.exit();
  }
}

runChecks();
