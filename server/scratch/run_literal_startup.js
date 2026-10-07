const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

process.env.DB_NAME = 'test_db_literal_startup';
const env = require('../src/config/env.config');
env.db.name = 'test_db_literal_startup';

async function run() {
  const rootConn = await mysql.createConnection({
    host: env.db.host,
    user: env.db.user,
    password: env.db.password
  });
  await rootConn.query('DROP DATABASE IF EXISTS test_db_literal_startup');
  await rootConn.query('CREATE DATABASE test_db_literal_startup');
  await rootConn.end();

  const conn = await mysql.createConnection({
    host: env.db.host,
    user: env.db.user,
    password: env.db.password,
    database: 'test_db_literal_startup',
    multipleStatements: true
  });

  // 1. Run base schema
  const schemaSql = fs.readFileSync(path.join(__dirname, '../database_schema.sql'), 'utf8');
  await conn.query(schemaSql);
  await conn.end();

  // 2. Run literal apply_migration.js
  console.log('Running server/apply_migration.js...');
  execSync('node apply_migration.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit', env: process.env });

  // 3. Run src/database/apply_migration.js (this is normally called in server.js)
  console.log('Running src/database/apply_migration.js...');
  const { applyMigrations } = require('../src/database/apply_migration.js');
  await applyMigrations();

  // 4. Dump the exact schema
  const dumpConn = await mysql.createConnection({
    host: env.db.host,
    user: env.db.user,
    password: env.db.password,
    database: 'test_db_literal_startup'
  });
  const [tables] = await dumpConn.query('SHOW TABLES');
  const tableKey = Object.keys(tables[0])[0];
  
  let resultSql = `-- PeerBridge Base Schema
-- Regenerated on: ${new Date().toISOString()}
-- Notice: This schema is automatically synchronized with runtime migrations. 
-- Do not edit this manually unless you are updating the base schema. Keep this in sync with migrations.

SET FOREIGN_KEY_CHECKS=0;

`;

  for (let i = 0; i < tables.length; i++) {
    const tableName = tables[i][tableKey];
    const [createTableInfo] = await dumpConn.query(`SHOW CREATE TABLE \`${tableName}\``);
    let createTableSql = createTableInfo[0]['Create Table'];
    createTableSql = createTableSql.replace(/AUTO_INCREMENT=\d+\s*/g, '');
    resultSql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
    resultSql += createTableSql + ';\n\n';
  }

  resultSql += 'SET FOREIGN_KEY_CHECKS=1;\n';
  fs.writeFileSync(path.join(__dirname, '../database_schema.sql'), resultSql);
  console.log('Successfully wrote to database_schema.sql');
  await dumpConn.end();
}

run().catch(console.error);
