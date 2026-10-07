const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { applyMigrations } = require('../src/database/apply_migration.js');
const { pool } = require('../src/config/db.config');

// Override the DB name in environment for tests
process.env.DB_NAME = 'test_db_real_startup';
const env = require('../src/config/env.config');
env.db.name = 'test_db_real_startup';

async function run() {
  const rootConn = await mysql.createConnection({
    host: env.db.host,
    user: env.db.user,
    password: env.db.password
  });
  await rootConn.query('DROP DATABASE IF EXISTS test_db_real_startup');
  await rootConn.query('CREATE DATABASE test_db_real_startup');
  await rootConn.end();

  const conn = await mysql.createConnection({
    host: env.db.host,
    user: env.db.user,
    password: env.db.password,
    database: 'test_db_real_startup',
    multipleStatements: true
  });

  const schemaSql = fs.readFileSync(path.join(__dirname, '../database_schema.sql'), 'utf8');
  await conn.query(schemaSql);
  await conn.end();

  // Now run the exact logic of server/apply_migration.js
  console.log('Running server/apply_migration.js logic...');
  const migrationPath = path.join(__dirname, '../database_migration.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    try {
      await pool.query(statement);
    } catch (err) {
      if (!err.message.includes('Duplicate column') && !err.message.includes('already exists')) {
        console.warn(`[SQL Error]: ${err.message}\n[Statement]: ${statement.substring(0, 50)}...`);
      }
    }
  }

  // Now run the exact logic of server/src/database/apply_migration.js
  console.log('Running server/src/database/apply_migration.js logic...');
  await applyMigrations();
}

run().then(() => {
  console.log('Startup finished.');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
