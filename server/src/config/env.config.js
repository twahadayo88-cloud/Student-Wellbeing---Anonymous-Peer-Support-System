/**
 * PeerBridge — Centralised Environment Configuration
 * ===================================================
 * Single source of truth for all environment variables.
 * Validates required variables at startup — fails fast if missing.
 */

const dotenv = require('dotenv');
const path = require('path');

// Load .env from server root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

/**
 * Required environment variables — server will not start without these.
 */
const REQUIRED_VARS = ['DB_HOST', 'DB_USER', 'DB_NAME', 'JWT_SECRET'];

/**
 * Validate that all required env vars are present.
 * Throws on missing variables to prevent silent failures.
 */
function validateEnv() {
  const missing = REQUIRED_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `[ENV] Missing required environment variables: ${missing.join(', ')}\n` +
        `  → Copy .env.example to .env and fill in the values.`
    );
  }
}

// Run validation immediately on import
validateEnv();

/**
 * Exported configuration object.
 * All env access should go through this module — never read process.env directly.
 */
const env = {
  // Server
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 5000,
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  isProduction: process.env.NODE_ENV === 'production',
  isDevelopment: process.env.NODE_ENV !== 'production',

  // Database
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD || '',
    name: process.env.DB_NAME,
  },

  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
    refreshSecret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  },
  // Keep this key stable; changing it prevents existing mood entries from being
  // associated with their owners for personal history and resource recommendations.
  moodDataSecret: process.env.MOOD_DATA_SECRET || process.env.JWT_SECRET,

  // Domain
  allowedEmailDomain: process.env.ALLOWED_EMAIL_DOMAIN || '',

  // Email
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
  },

  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX, 10) || 100,
  },

  // File Uploads
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024,

  // Logging
  logLevel: process.env.LOG_LEVEL || 'debug',
};

module.exports = env;
