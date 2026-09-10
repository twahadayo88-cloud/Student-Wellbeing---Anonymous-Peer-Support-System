const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '1234',
  database: process.env.DB_NAME || 'peerbridge',
};

async function run() {
  console.log('Connecting to database with config:', { ...dbConfig, password: '***' });
  const connection = await mysql.createConnection(dbConfig);
  try {
    // 1. Show all tables
    const [tables] = await connection.query('SHOW TABLES');
    console.log('\n--- TABLES ---');
    console.log(tables.map(t => Object.values(t)[0]));

    // 2. Describe profiles table
    console.log('\n--- DESCRIBE profiles ---');
    try {
      const [columns] = await connection.query('DESCRIBE profiles');
      console.table(columns);
    } catch (e) {
      console.error('profiles describe failed:', e.message);
    }

    // 3. Describe users table
    console.log('\n--- DESCRIBE users ---');
    try {
      const [columns] = await connection.query('DESCRIBE users');
      console.table(columns);
    } catch (e) {
      console.error('users describe failed:', e.message);
    }

    // 4. Check table moderation_queue
    console.log('\n--- DESCRIBE moderation_queue ---');
    try {
      const [columns] = await connection.query('DESCRIBE moderation_queue');
      console.table(columns);
    } catch (e) {
      console.error('moderation_queue describe failed:', e.message);
    }

    // 5. Check table escalation_records
    console.log('\n--- DESCRIBE escalation_records ---');
    try {
      const [columns] = await connection.query('DESCRIBE escalation_records');
      console.table(columns);
    } catch (e) {
      console.error('escalation_records describe failed:', e.message);
    }

    // 6. Check table anonymous_id_history
    console.log('\n--- DESCRIBE anonymous_id_history ---');
    try {
      const [columns] = await connection.query('DESCRIBE anonymous_id_history');
      console.table(columns);
    } catch (e) {
      console.error('anonymous_id_history describe failed:', e.message);
    }

    // 7. Check audit logs count
    console.log('\n--- AUDIT LOGS COUNT ---');
    try {
      const [rows] = await connection.query('SELECT COUNT(*) as count FROM audit_logs');
      console.log('Count:', rows[0].count);
    } catch (e) {
      console.error('audit_logs count failed:', e.message);
    }
  } catch (err) {
    console.error('Error executing query:', err);
  } finally {
    await connection.end();
  }
}

run();
