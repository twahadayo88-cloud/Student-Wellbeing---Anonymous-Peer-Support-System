const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const [sosCols] = await connection.query('SHOW COLUMNS FROM sos_records');
    console.log('\n--- SOS_RECORDS COLUMNS ---');
    sosCols.forEach(c => console.log(`${c.Field}: ${c.Type} | Null: ${c.Null} | Default: ${c.Default}`));

    const [academicCols] = await connection.query('SHOW COLUMNS FROM academic_requests');
    console.log('\n--- ACADEMIC_REQUESTS COLUMNS ---');
    academicCols.forEach(c => console.log(`${c.Field}: ${c.Type} | Null: ${c.Null} | Default: ${c.Default}`));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

run();
