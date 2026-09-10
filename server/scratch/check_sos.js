const { pool } = require('../src/config/db.config');

async function checkSOS() {
  try {
    console.log('--- SOS RECORDS CHECK ---');
    const [rows] = await pool.execute('SELECT * FROM sos_records ORDER BY id DESC LIMIT 3');
    console.table(rows);
    console.log('--- END CHECK ---');
  } catch (e) {
    console.error('CHECK FAILED:', e);
  } finally {
    process.exit();
  }
}

checkSOS();
