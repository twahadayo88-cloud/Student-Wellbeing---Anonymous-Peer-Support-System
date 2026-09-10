const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db.config');
const logger = require('./logger');

/**
 * migrationRunner — Automated SQL script execution.
 * Reads a .sql file, splits it by semicolons, and executes
 * each statement against the current database pool.
 */
async function run(filename) {
  const filePath = path.join(__dirname, '../../', filename);
  
  if (!fs.existsSync(filePath)) {
    logger.warn(`Migration file not found: ${filename} — skipping automigration.`);
    return;
  }

  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Split by semicolon, filter empty lines/comments
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    logger.info(`Starting migration for ${filename} (${statements.length} statements)...`);

    const connection = await pool.getConnection();
    try {
      for (const statement of statements) {
        try {
          await connection.query(statement);
        } catch (stmtError) {
          // Ignore "Already exists" errors which are common in additive migrations
          if (stmtError.code === 'ER_DUP_FIELDNAME' || stmtError.code === 'ER_TABLE_EXISTS_ERROR' || stmtError.code === 'ER_DUP_KEYNAME') {
            logger.debug(`Migration statement skipped (already exists): ${statement.substring(0, 50)}...`);
            continue;
          }
          // Log other errors but keep going to prevent blocking the whole startup
          logger.warn(`Migration statement failed: ${statement.substring(0, 50)}...`, { error: stmtError.message });
        }
      }
      logger.info(`✓ Database Migration Logic Finished: ${filename}`);
    } finally {
      connection.release();
    }
  } catch (error) {
    logger.error(`✗ Database Migration Failed: ${filename}`, { error: error.message });
    // We don't throw here to allow the server to still start, 
    // but the error is logged prominently.
  }
}

module.exports = { run };
