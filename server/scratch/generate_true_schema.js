const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const env = require('../src/config/env.config');
env.db.name = 'test_db_true_schema';

async function run() {
  const rootConn = await mysql.createConnection({
    host: env.db.host,
    user: env.db.user,
    password: env.db.password
  });
  await rootConn.query('DROP DATABASE IF EXISTS test_db_true_schema');
  await rootConn.query('CREATE DATABASE test_db_true_schema');
  await rootConn.end();

  const conn = await mysql.createConnection({
    host: env.db.host,
    user: env.db.user,
    password: env.db.password,
    database: 'test_db_true_schema',
    multipleStatements: true
  });

  const schemaSql = fs.readFileSync(path.join(__dirname, '../database_schema.sql'), 'utf8');
  await conn.query(schemaSql);

  const migrationSql = fs.readFileSync(path.join(__dirname, '../database_migration.sql'), 'utf8');
  // Run all statements natively, handling errors gracefully for ALTER TABLE
  const statements = migrationSql.split(';');
  for (let s of statements) {
    if (s.trim().length === 0) continue;
    try {
      await conn.query(s);
    } catch (e) {
      if (!e.message.includes('Duplicate column')) {
        console.warn('Skipped error:', e.message);
      }
    }
  }

  // Also apply src/database/apply_migration.js patches!
  const { applyMigrations } = require('../src/database/apply_migration.js');
  try {
    await applyMigrations();
  } catch(e) {
    console.error('applyMigrations error', e);
  }

  // Now dump the schema!
  const [tables] = await conn.query('SHOW TABLES');
  const tableKey = Object.keys(tables[0])[0];
  
  let resultSql = `-- PeerBridge Base Schema
-- Regenerated on: ${new Date().toISOString()}
-- Notice: This schema is automatically synchronized with runtime migrations. 
-- Do not edit this manually unless you are updating the base schema. Keep this in sync with migrations.

SET FOREIGN_KEY_CHECKS=0;

`;

  for (let i = 0; i < tables.length; i++) {
    const tableName = tables[i][tableKey];
    const [createTableInfo] = await conn.query(`SHOW CREATE TABLE \`${tableName}\``);
    let createTableSql = createTableInfo[0]['Create Table'];
    createTableSql = createTableSql.replace(/AUTO_INCREMENT=\d+\s*/g, '');
    resultSql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
    resultSql += createTableSql + ';\n\n';
  }

  resultSql += 'SET FOREIGN_KEY_CHECKS=1;\n';
  fs.writeFileSync(path.join(__dirname, '../database_schema.sql'), resultSql);
  console.log('Successfully wrote to database_schema.sql');

  await conn.end();
}
run().catch(console.error);
