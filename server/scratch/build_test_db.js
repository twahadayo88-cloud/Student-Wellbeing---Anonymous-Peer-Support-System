const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const env = require('../src/config/env.config');
const { applyMigrations } = require('../src/database/apply_migration.js');

async function run() {
  const rootConn = await mysql.createConnection({
    host: env.db.host,
    user: env.db.user,
    password: env.db.password
  });

  await rootConn.query('DROP DATABASE IF EXISTS test_db_full');
  await rootConn.query('CREATE DATABASE test_db_full');
  await rootConn.end();

  const conn = await mysql.createConnection({
    host: env.db.host,
    user: env.db.user,
    password: env.db.password,
    database: 'test_db_full',
    multipleStatements: true
  });

  console.log('Applying database_schema.sql');
  const schemaSql = fs.readFileSync(path.join(__dirname, '../database_schema.sql'), 'utf8');
  await conn.query(schemaSql);

  console.log('Applying database_migration.sql');
  const migrationSql = fs.readFileSync(path.join(__dirname, '../database_migration.sql'), 'utf8');
  const statements = migrationSql.split(';').map(s => s.trim()).filter(s => s.length > 0 && !s.startsWith('--'));
  for (const statement of statements) {
    try {
      await conn.query(statement);
    } catch (err) {
      console.warn(`[SQL Error]: ${err.message}\n[Statement]: ${statement}\n`);
    }
  }

  await conn.end();

  // Test apply_migration directly
  env.db.name = 'test_db_full';
  console.log('Applying apply_migration.js');
  try {
    await applyMigrations();
  } catch(e) {
    console.error('applyMigrations error', e);
  }
}

run().catch(console.error);
