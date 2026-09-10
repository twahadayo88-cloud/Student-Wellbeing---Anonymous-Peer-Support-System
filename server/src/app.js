/**
 * PeerBridge — Express Application Configuration
 * ================================================
 * Configures middleware, routes, and error handling.
 * Exported separately from server.js for testability.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env.config');

// Middleware
const requestLogger = require('./middleware/requestLogger');
const { apiLimiter, adminLimiter } = require('./middleware/rateLimiter');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');


// Routes
const authRoutes = require('./modules/auth/auth.routes');
const profileRoutes = require('./modules/profile/profile.routes');
const communicationRoutes = require('./modules/communication/communication.routes');
const matchRoutes = require('./modules/match/match.routes');
const chatRoutes = require('./modules/chat/chat.routes');
const feedbackRoutes = require('./modules/feedback/feedback.routes');
const adminRoutes = require('./modules/admin/admin.routes');
const academicRoutes = require('./modules/academic/academic.routes');

const app = express();

// ─── Security ─────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: env.clientUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// ─── Body Parsing ─────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ──────────────────────────────────────────
app.use(requestLogger);

// ─── Rate Limiting ────────────────────────────────────
// Admin routes get a more generous limiter (dashboard fires 8+ parallel calls on mount)
app.use('/api/admin', adminLimiter);
app.use('/api/academic', adminLimiter);
app.use('/api/trust', adminLimiter);
app.use('/api/', apiLimiter);

// ─── Health Check ─────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.status(200).json({
    success: true,
    status: 'ok',
    message: 'PeerBridge API is running',
    timestamp: new Date().toISOString(),
    environment: env.nodeEnv,
  });
});

// ─── API Routes ───────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/match', matchRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/academic', academicRoutes);
app.use('/api/trust', require('./modules/trust/trust.routes'));
logger.info('✓ Academic routes registered');
logger.info('✓ Trust routes registered');

// ─── 404 Handler (after routes) ───────────────────────
app.use(notFound);

// ─── Global Error Handler (must be last) ──────────────
app.use(errorHandler);

module.exports = app;
