const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/db.config');

async function run() {
  let connection;
  try {
    connection = await pool.getConnection();
    
    // 1. Verify Database Name
    const [dbRows] = await connection.query('SELECT DATABASE() as db');
    const dbName = dbRows[0].db;
    console.log(`Connected Database: ${dbName}`);
    
    if (dbName !== 'peerbridge') {
      throw new Error(`Expected database 'peerbridge', but connected to '${dbName}'`);
    }

    // 2. Snapshot of tables before
    const [tablesBefore] = await connection.query('SHOW TABLES');
    console.log(`\nTables Before Drop (${tablesBefore.length}):`);
    const beforeList = tablesBefore.map(t => Object.values(t)[0]);
    console.log(beforeList.join(', '));

    // 3. Execute the SQL Migration
    const sqlPath = path.resolve(__dirname, '../src/database/drop_sos_records.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
    
    console.log(`\nExecuting Migration:`);
    console.log(sqlContent.trim());
    
    const [result] = await connection.query(sqlContent);
    console.log('Migration execution successful.', result);

    // 4. Snapshot of tables after
    const [tablesAfter] = await connection.query('SHOW TABLES');
    console.log(`\nTables After Drop (${tablesAfter.length}):`);
    const afterList = tablesAfter.map(t => Object.values(t)[0]);
    console.log(afterList.join(', '));
    
    // 5. Verification checks
    if (!afterList.includes('sos_records')) {
      console.log('\nVerification: sos_records has been successfully dropped.');
    } else {
      console.error('\nVerification Error: sos_records still exists!');
    }
    
    if (tablesBefore.length - tablesAfter.length === 1) {
      console.log('Verification: Only one table was dropped. All other tables remain unchanged.');
    } else {
      console.error('Verification Error: More than one table or no tables were affected!');
    }

  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    if (connection) connection.release();
    process.exit(0);
  }
}

run();
