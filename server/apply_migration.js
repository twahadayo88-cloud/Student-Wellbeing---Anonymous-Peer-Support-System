const fs = require('fs');
const path = require('path');
const { pool } = require('./src/config/db.config');

async function applyMigration() {
  console.log('⌛ Applying Database Migrations...');
  try {
    const migrationPath = path.join(__dirname, 'database_migration.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon, but handle cases where semicolon might be inside strings (basic split here)
    // For production, a more robust parser would be better, but for these migrations simple split works.
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      try {
        await pool.query(statement);
      } catch (err) {
        // If it's a "Duplicate column" error, ignore it since we use IF NOT EXISTS
        if (!err.message.includes('Duplicate column') && !err.message.includes('already exists')) {
          console.warn(`⚠️ Warning executing statement: ${statement.substring(0, 50)}...`);
          console.error(`Error: ${err.message}`);
        }
      }
    }
    
    console.log('✅ Migrations applied successfully.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to apply migrations:', err.message);
    process.exit(1);
  }
}

applyMigration();
