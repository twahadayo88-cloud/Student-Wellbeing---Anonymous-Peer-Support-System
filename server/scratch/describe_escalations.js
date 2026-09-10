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
    const [escCols] = await connection.query('SHOW COLUMNS FROM escalation_records');
    console.log('\n--- ESCALATION_RECORDS COLUMNS ---');
    escCols.forEach(c => console.log(`${c.Field}: ${c.Type} | Null: ${c.Null} | Default: ${c.Default}`));

    const [auditCols] = await connection.query('SHOW COLUMNS FROM audit_logs');
    console.log('\n--- AUDIT_LOGS COLUMNS ---');
    auditCols.forEach(c => console.log(`${c.Field}: ${c.Type} | Null: ${c.Null} | Default: ${c.Default}`));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

run();
