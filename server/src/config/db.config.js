/**
 * PeerBridge — MySQL Database Configuration
 * ==========================================
 * Creates a connection pool using mysql2/promise.
 * All queries use prepared statements for SQL injection prevention.
 */

const mysql = require('mysql2/promise');
const env = require('./env.config');
const logger = require('../utils/logger');

/**
 * MySQL connection pool.
 * - Uses prepared statements by default
 * - Connections are reused, not opened/closed per query
 * - Pool auto-manages connection lifecycle
 */
const pool = mysql.createPool({
  host: env.db.host,
  port: env.db.port,
  user: env.db.user,
  password: env.db.password,
  database: env.db.name,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Timezone + charset for proper Unicode support
  timezone: '+00:00',
  charset: 'utf8mb4',
});

/**
 * Test the database connection.
 * Called once at server startup to verify connectivity.
 * Logs the result and throws on failure.
 */
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    logger.info('✓ MySQL connected successfully', {
      host: env.db.host,
      database: env.db.name,
    });
    connection.release();
    return true;
  } catch (error) {
    logger.error('✗ MySQL connection failed', {
      host: env.db.host,
      database: env.db.name,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Execute a parameterised query.
 * Wraps pool.execute with logging for debugging.
 *
 * @param {string} sql - SQL query string with ? placeholders
 * @param {Array}  params - Parameter values for prepared statement
 * @returns {Promise<Array>} [rows, fields]
 */
async function query(sql, params = []) {
  try {
    const [rows, fields] = await pool.execute(sql, params);
    return [rows, fields];
  } catch (error) {
    logger.error('Database query error', {
      sql: sql.substring(0, 200), // Truncate for log safety
      error: error.message,
    });
    throw error;
  }
}

module.exports = {
  pool,
  testConnection,
  query,
};
