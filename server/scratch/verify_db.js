const { pool } = require('../src/config/db.config');

async function checkTables() {
  const tablesToCheck = [
    'academic_requests', 'helper_listings', 'request_appeals', 'daily_post_tracker',
    'escalation_records', 'moderation_queue', 'anonymous_id_history'
  ];
  
  for (const table of tablesToCheck) {
    try {
      const [rows] = await pool.query(`SHOW TABLES LIKE '${table}'`);
      console.log(`${table}: ${rows.length > 0 ? '✅ EXISTS' : '❌ MISSING'}`);
      if (rows.length > 0) {
        const [columns] = await pool.query(`DESCRIBE ${table}`);
        console.log(`-- Columns for ${table}:`, columns.map(c => c.Field).join(', '));
      }
    } catch (err) {
      console.log(`${table}: ❌ ERROR (${err.message})`);
    }
  }
  
  // Check behavior_score in profiles
  try {
    const [cols] = await pool.query("SHOW COLUMNS FROM profiles LIKE 'behavior_score'");
    console.log(`profiles.behavior_score: ${cols.length > 0 ? '✅ EXISTS' : '❌ MISSING'}`);
  } catch (err) {
    console.log(`profiles.behavior_score: ❌ ERROR (${err.message})`);
  }
  
  process.exit(0);
}

checkTables();
