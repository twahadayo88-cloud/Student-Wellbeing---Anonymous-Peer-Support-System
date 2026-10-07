const mysql = require('mysql2/promise');
const fs = require('fs');

const env = require('../src/config/env.config');

async function dumpSchema() {
  const connection = await mysql.createConnection({
    host: env.db.host,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name
  });

  const [tables] = await connection.query('SHOW TABLES');
  const tableKey = Object.keys(tables[0])[0];
  
  let schemaSql = `-- PeerBridge Base Schema
-- Regenerated on: ${new Date().toISOString()}
-- Notice: This schema is automatically synchronized with runtime migrations. 
-- Do not edit this manually unless you are updating the base schema. Keep this in sync with migrations.

SET FOREIGN_KEY_CHECKS=0;

`;

  // Get CREATE TABLE statements for all tables
  for (let i = 0; i < tables.length; i++) {
    const tableName = tables[i][tableKey];
    const [createTableInfo] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
    let createTableSql = createTableInfo[0]['Create Table'];
    
    // Clean up AUTO_INCREMENT to not have specific values
    createTableSql = createTableSql.replace(/AUTO_INCREMENT=\d+\s*/g, '');
    
    schemaSql += `-- Table structure for \`${tableName}\`\n`;
    schemaSql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
    schemaSql += createTableSql + ';\n\n';
  }

  schemaSql += 'SET FOREIGN_KEY_CHECKS=1;\n';

  fs.writeFileSync('scratch/schema_dump.sql', schemaSql);
  console.log('Schema successfully exported to scratch/schema_dump.sql');
  await connection.end();
}

dumpSchema().catch(console.error);
