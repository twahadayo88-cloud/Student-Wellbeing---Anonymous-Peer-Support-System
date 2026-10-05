const { pool } = require('../src/config/db.config');

async function run() {
  try {
    console.log('--- 1. CONVERSATIONS TABLE ---');
    const [tables] = await pool.query("SHOW TABLES LIKE 'conversations'");
    console.log('Tables found:', tables);
    if (tables.length > 0) {
      const [cols] = await pool.query('DESCRIBE conversations');
      console.log('Columns:', cols);
      const [count] = await pool.query('SELECT COUNT(*) as count FROM conversations');
      console.log('Row count:', count);
      const [fks] = await pool.query("SELECT CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = 'peerbridge' AND TABLE_NAME = 'conversations'");
      console.log('Keys/FKs in conversations:', fks);
      const [refs] = await pool.query("SELECT CONSTRAINT_NAME, TABLE_NAME, COLUMN_NAME FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA = 'peerbridge' AND REFERENCED_TABLE_NAME = 'conversations'");
      console.log('Tables referencing conversations:', refs);
    }

    console.log('\n--- 2. TRUST SCORE FIELDS & PROFILES SCHEMA ---');
    const [profileCols] = await pool.query("DESCRIBE profiles");
    console.log('Profiles columns:', profileCols.map(c => ({ Field: c.Field, Type: c.Type, Default: c.Default })));
    
    const [tablesTrust] = await pool.query("SHOW TABLES LIKE '%trust%'");
    console.log('Trust tables:', tablesTrust);
    for (const t of tablesTrust) {
      const tName = Object.values(t)[0];
      const [cols] = await pool.query(`DESCRIBE ${tName}`);
      console.log(`Schema for ${tName}:`, cols.map(c => ({ Field: c.Field, Type: c.Type, Default: c.Default })));
    }

    console.log('\n--- 3. HELPER LISTINGS & ACADEMIC TABLES ---');
    const [tablesAcad] = await pool.query("SHOW TABLES LIKE '%helper%'");
    console.log('Helper tables:', tablesAcad);
    for (const t of tablesAcad) {
      const tName = Object.values(t)[0];
      const [cols] = await pool.query(`DESCRIBE ${tName}`);
      console.log(`Schema for ${tName}:`, cols.map(c => ({ Field: c.Field, Type: c.Type, Default: c.Default })));
    }

    console.log('\n--- 4. CHAT_MESSAGES SCHEMA ---');
    const [msgCols] = await pool.query("DESCRIBE chat_messages");
    console.log('chat_messages columns:', msgCols.map(c => ({ Field: c.Field, Type: c.Type, Default: c.Default })));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

run();
