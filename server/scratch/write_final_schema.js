const fs = require('fs');

const realSchema = fs.readFileSync('scratch/schema_dump_real.sql', 'utf8');

const header = `-- PeerBridge Base Schema
-- Regenerated on: ${new Date().toISOString()}
-- Notice: This schema is automatically synchronized with runtime migrations. 
-- Do not edit this manually unless you are updating the base schema. Keep this in sync with migrations.

SET FOREIGN_KEY_CHECKS=0;

`;

const result = header + realSchema + '\nSET FOREIGN_KEY_CHECKS=1;\n';
fs.writeFileSync('database_schema.sql', result);
console.log('Saved to database_schema.sql');
