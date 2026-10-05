const { query } = require('../src/config/db.config');

async function checkSosRecords() {
  try {
    const [rows] = await query('SELECT COUNT(*) AS count FROM sos_records');
    console.log(`Row count: ${rows[0].count}`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkSosRecords();
