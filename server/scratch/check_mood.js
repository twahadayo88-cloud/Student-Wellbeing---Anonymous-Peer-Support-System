const { query } = require('../src/config/db.config');

async function checkMood() {
  try {
    console.log('--- Recent Mood Entries ---');
    const [rows] = await query('SELECT mood_score, notes, created_at FROM mood_entries ORDER BY created_at DESC LIMIT 5');
    console.table(rows);
    process.exit(0);
  } catch (err) {
    console.error('Failed to query mood_entries:', err.message);
    process.exit(1);
  }
}

checkMood();
