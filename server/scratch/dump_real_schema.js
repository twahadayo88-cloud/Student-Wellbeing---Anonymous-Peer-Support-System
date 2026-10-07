const mysql = require('mysql2/promise');
const fs = require('fs');
const env = require('../src/config/env.config');

async function dumpSchema() {
  const connection = await mysql.createConnection({
    host: env.db.host,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name // connect to the REAL database
  });

  const [tables] = await connection.query('SHOW TABLES');
  const tableKey = Object.keys(tables[0])[0];
  
  let schemaSql = `-- PeerBridge Base Schema
-- Regenerated on: ${new Date().toISOString()}
-- Notice: This schema is automatically synchronized with runtime migrations. 
-- Do not edit this manually unless you are updating the base schema. Keep this in sync with migrations.

SET FOREIGN_KEY_CHECKS=0;

`;

  for (let i = 0; i < tables.length; i++) {
    const tableName = tables[i][tableKey];
    const [createTableInfo] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
    let createTableSql = createTableInfo[0]['Create Table'];
    
    // Clean up AUTO_INCREMENT
    createTableSql = createTableSql.replace(/AUTO_INCREMENT=\d+\s*/g, '');
    
    schemaSql += `DROP TABLE IF EXISTS \`${tableName}\`;\n`;
    schemaSql += createTableSql + ';\n\n';
  }

  schemaSql += 'SET FOREIGN_KEY_CHECKS=1;\n';
  fs.writeFileSync('scratch/schema_dump_real.sql', schemaSql);
  console.log('Real Schema successfully exported to scratch/schema_dump_real.sql');
  await connection.end();
}

dumpSchema().catch(console.error);
