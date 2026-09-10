/**
 * PeerBridge — Server Entry Point
 * ================================
 * Starts the HTTP server, connects to MySQL, and initialises Socket.io.
 * This is the only file that calls .listen() and manages process lifecycle.
 */

const http = require('http');
const app = require('./app');
const env = require('./config/env.config');
const { testConnection } = require('./config/db.config');
const { initSocket } = require('./config/socket.config');
const { initCronJobs } = require('./cron/cleaner.cron');
const logger = require('./utils/logger');
const migrationRunner = require('./utils/migrationRunner');

// Create HTTP server (required for Socket.io)
const server = http.createServer(app);

/**
 * Bootstrap sequence:
 * 1. Test MySQL connection
 * 2. Initialise Socket.io
 * 3. Start listening
 */
process.on('uncaughtException', (err) => {
  console.error('GLOBAL UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});

async function startServer() {
  try {
    // 1. Database connection
    await testConnection();
    
    // Automated Database Migrations (Initial schema creation)
    await migrationRunner.run('database_migration.sql');
    
    // Auto-Migrate & Health Check (Safely patch missing columns + backup)
    console.log('Migration runner done');
    const { applyMigrations } = require('./database/apply_migration');
    console.log('apply_migration loaded');
    await applyMigrations();
    console.log('applyMigrations done');
    
    // Initialize GDPR Crons
    initCronJobs();

    // 2. Socket.io
    initSocket(server);

    // 3. Start listening
    logger.info(`Attempting to listen on port ${env.port}...`);
    server.listen(env.port, () => {
      logger.info(`
  ╔══════════════════════════════════════════════════╗
  ║                                                  ║
  ║   PeerBridge API Server                          ║
  ║   Environment : ${env.nodeEnv.padEnd(31)}║
  ║   Port        : ${String(env.port).padEnd(31)}║
  ║   Client URL  : ${env.clientUrl.padEnd(31)}║
  ║                                                  ║
  ╚══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('STARTUP ERROR MESSAGE:', error.message);
    console.error('STARTUP ERROR STACK:', error.stack);
    logger.error('Failed to start server', { error: error.message });

    // If DB connection fails, still start the server (for health checks)
    // but log a clear warning
    if (error.code === 'ECONNREFUSED' || error.code === 'ER_ACCESS_DENIED_ERROR') {
      logger.warn('Starting server WITHOUT database connection...');
      server.listen(env.port, () => {
        logger.warn(`Server running on port ${env.port} — DATABASE NOT CONNECTED`);
      });
    } else {
      process.exit(1);
    }
  }
}

// ─── Graceful Shutdown ────────────────────────────────
function gracefulShutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully...`);
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force shutdown after 10 seconds
  setTimeout(() => {
    logger.error('Forced shutdown — timeout exceeded');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection', { reason: reason?.message || reason });
});

// Start the server
startServer();

module.exports = server;
