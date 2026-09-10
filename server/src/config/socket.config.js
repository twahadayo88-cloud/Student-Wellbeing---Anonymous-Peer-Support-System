const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('./env.config');
const logger = require('../utils/logger');
const { query } = require('./db.config');
const communicationService = require('../modules/communication/communication.service');
const profileService = require('../modules/profile/profile.service');
const matchService = require('../modules/match/match.service');
const adminService = require('../modules/admin/admin.service');
const { AUDIT_ACTIONS, ROLES } = require('../utils/constants');

let io = null;

// Map to track active connections: anonymousId -> socket.id
const userSockets = new Map();

function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Authentication Middleware for Socket.io
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      if (!token) {
        return next(new Error('Authentication error: Token missing'));
      }

      const decoded = jwt.verify(token, env.jwt.secret);
      socket.userId = decoded.user_id;
      socket.role = decoded.role; // Track Role

      const anonymousId = await communicationService.getAnonymousIdByUserId(decoded.user_id);
      if (!anonymousId) {
        return next(new Error('Authentication error: Profile not found'));
      }

      socket.anonymousId = anonymousId;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info('Socket connected', { socketId: socket.id, anonymousId: socket.anonymousId });

    // Register user to the online map
    userSockets.set(socket.anonymousId, socket.id);

    // Join Personal Room for reliable relay (Multi-tab support)
    socket.join(socket.anonymousId);
    logger.info(`User joined personal room: ${socket.anonymousId}`, { socketId: socket.id });

    // Join Admin Room for real-time alerts
    if (socket.role === ROLES.ADMIN || socket.role === ROLES.SUPER_ADMIN) {
      socket.join('admin_room');
      logger.info(`Admin joined admin_room: ${socket.anonymousId}`);
    }

    // Join Department Room for Broadcasts
    const joinDeptRoom = async () => {
      try {
        // BUG-002 FIX: query() returns [rows, fields] — must destructure [[firstRow]]
        const [[profile]] = await query('SELECT department FROM profiles WHERE user_id = ?', [socket.userId]);
        if (profile && profile.department) {
          socket.department = profile.department;
          const deptRoom = `dept_${profile.department.toLowerCase()}`;
          socket.join(deptRoom);
          logger.info(`User joined department room: ${deptRoom}`, { anonymousId: socket.anonymousId });
        }
      } catch (err) {
        logger.error('Failed to join department room', { error: err.message });
      }
    };
    joinDeptRoom();

    // ─── NEW REAL-TIME EVENTS ───────────────────────────────────────────────

    // dashboard:init — send full dashboard data when user connects
    socket.on('dashboard:init', async () => {
      try {
        const [profile, conversations, pendingRequests, recommendations] = await Promise.all([
          profileService.getProfileByUserId(socket.userId),
          communicationService.getUserConversations(socket.userId),
          matchService.getPendingRequests(socket.userId),
          matchService.getRecommendations(socket.userId),
        ]);

        let facultyFallback = [];
        if (recommendations.length === 0) {
          facultyFallback = await matchService.getFacultyFallback(socket.userId);
        }

        socket.emit('dashboard:data', {
          stats: {
            active_conversations: conversations.length,
            matching_peers: recommendations.length,
            pending_requests: pendingRequests.incoming.length,
            trust_score: profile?.trust_score ?? 50,
          },
          pending_requests: pendingRequests,
          active_chats: conversations,
          recommended_peers: recommendations,
          faculty_fallback: facultyFallback,
          anonymous_id: profile?.anonymous_id,
          onboarding_required: profile?.is_first_login ?? false,
          badge_tier: profile?.badge_tier,
        });
      } catch (err) {
        logger.error('dashboard:init error', { error: err.message });
        socket.emit('dashboard:error', { message: 'Failed to load dashboard data' });
      }
    });

    // profile:get — send full profile to requesting user
    socket.on('profile:get', async () => {
      try {
        const profile = await profileService.getProfileByUserId(socket.userId);
        if (!profile) return socket.emit('profile:error', { message: 'Profile not found' });
        socket.emit('profile:data', profile);
      } catch (err) {
        logger.error('profile:get error', { error: err.message });
        socket.emit('profile:error', { message: 'Failed to load profile' });
      }
    });

    // profile:update — save profile changes via socket and broadcast back
    socket.on('profile:update', async (updates) => {
      try {
        await profileService.updateProfile(socket.userId, updates, socket.role);

        // Mark first login complete
        if (updates.is_first_login === false) {
          await profileService.updateProfile(socket.userId, { is_first_login: false }, socket.role);
        }

        const updatedProfile = await profileService.getProfileByUserId(socket.userId);
        socket.emit('profile:data', updatedProfile);
        socket.emit('trust_score:updated', { trust_score: updatedProfile?.trust_score ?? 50 });
      } catch (err) {
        logger.error('profile:update error', { error: err.message });
        socket.emit('profile:error', { message: 'Failed to update profile' });
      }
    });

    // admin:init — send dashboard data to administrator
    socket.on('admin:init', async () => {
      try {
        if (socket.role !== ROLES.ADMIN && socket.role !== ROLES.SUPER_ADMIN) return;

        const [stats, sosRecords] = await Promise.all([
          adminService.getPlatformStats(),
          adminService.getSOSRecords()
        ]);

        socket.emit('admin:stats', stats);
        socket.emit('admin:sos_alerts', sosRecords);
      } catch (err) {
        logger.error('admin:init error', { error: err.message });
        socket.emit('admin:error', { message: 'Failed to load admin data' });
      }
    });

    // ─── END NEW REAL-TIME EVENTS ───────────────────────────────────────────

    // 1. Typing Indicator
    socket.on('typing_start', (data) => {
      const { receiver_anonymous_id } = data;
      io.to(receiver_anonymous_id).emit('peer_typing_start', { sender_anonymous_id: socket.anonymousId });
    });

    socket.on('typing_stop', (data) => {
      const { receiver_anonymous_id } = data;
      io.to(receiver_anonymous_id).emit('peer_typing_stop', { sender_anonymous_id: socket.anonymousId });
    });

    // 2. Read Receipts
    socket.on('message_seen', async (data) => {
      const { message_id, sender_anonymous_id } = data;
      try {
        await communicationService.markMessageSeen(message_id, socket.userId);
        io.to(sender_anonymous_id).emit('message_read', { message_id, seen_at: new Date() });
      } catch (err) {
        logger.error('Failed to mark message seen', { error: err.message });
      }
    });

    // 3. Send Message
    socket.on('send_message', async (data) => {
      try {
        const { receiver_anonymous_id, message, chat_mode = 'chat_only' } = data;

        if (!message || message.trim() === '') {
          return socket.emit('message_error', { error: 'Message cannot be empty' });
        }

        const receiverId = await communicationService.getUserIdByAnonymousId(receiver_anonymous_id);
        if (!receiverId) {
          return socket.emit('message_error', { error: 'Receiver not found' });
        }

        // Role-Based Messaging check (Faculty can broadcast, Students can't spam faculty arbitrarily without match - placeholder logic enforcement check)
        const receiverRole = await communicationService.getUserRoleById(receiverId);
        // Ex: Ensure student isn't brute forcing super admins
        if (socket.role === 'student' && receiverRole === 'admin') {
          return socket.emit('message_error', { error: 'Direct messaging to administrators is restricted.' });
        }

        // Block & Report System enforcement
        const isBlocked = await communicationService.checkIfBlocked(socket.userId, receiverId);
        if (isBlocked) {
          return socket.emit('message_error', { error: 'Message blocked by recipient.' });
        }

        // AI Moderation & Pipeline Monitoring
        const safetyService = require('../modules/safety/safety.service');
        const moderationResult = await safetyService.monitorContent(message, 'message', socket.userId);

        // 4. Severity Scoring & SOS Trigger
        if (moderationResult.severity === 'HIGH') {
          // Log the trigger action
          logger.audit(AUDIT_ACTIONS.MESSAGE_FLAGGED, {
            action: 'SOS_TRIGGERED',
            sender: socket.anonymousId,
            message: '[ENCRYPTED_PAYLOAD_MASKED]',
            severity: 'HIGH'
          });

          await communicationService.storeSOSRecord(
            socket.userId, 
            moderationResult.reason || 'High Risk Message Detected'
          );

          // Save violation to DB
          const violationType = moderationResult.reason || 'toxic_message';
          const violationRecord = await safetyService.addViolationRecord(socket.userId, violationType, 'HIGH');

          // Fetch latest escalation record ID for real-time notification
          const [escalationRows] = await query(
            'SELECT id FROM escalation_records WHERE user_id = ? ORDER BY id DESC LIMIT 1',
            [socket.userId]
          );

          // Notify Admins
          io.to('admin_room').emit('admin:new_violation', {
            id: escalationRows[0]?.id || violationRecord.insertId,
            anonymous_id: socket.anonymousId,
            user_id: socket.userId,
            violation_type: violationType,
            severity: 'HIGH',
            created_at: new Date()
          });

          io.emit('sos_trigger', {
            alert: 'High-risk content detected. Immediate moderation assistance required.',
            timestamp: new Date()
          });

          return socket.emit('message_error', { error: 'Message flagged for severe violating content. Support is being notified.' });
        }

        if (moderationResult.severity === 'MEDIUM') {
          logger.audit(AUDIT_ACTIONS.MESSAGE_FLAGGED, {
            action: 'WARNING_LOGGED',
            sender: socket.anonymousId,
            severity: 'MEDIUM'
          });
        }

        // End-to-End Encryption Storage
        const messageId = await communicationService.storeMessage(
          socket.userId,
          receiverId,
          message,
          moderationResult.severity !== 'LOW', // is_flagged
          chat_mode
        );

        // Insert MEDIUM severity messages into moderation queue for admin review
        if (moderationResult.severity === 'MEDIUM') {
          await safetyService.addToModerationQueue(
            'message',
            messageId,
            message,
            socket.userId,
            'MEDIUM',
            moderationResult.reason || 'Flagged chat message'
          );
        }

        logger.audit(AUDIT_ACTIONS.MESSAGE_SENT, { sender: socket.anonymousId, receiver: receiver_anonymous_id, mode: chat_mode });

        const formattedMessage = {
          id: messageId,
          sender_anonymous_id: socket.anonymousId,
          receiver_anonymous_id,
          message, // Decrypted purely in memory for immediate socket relay payload
          chat_mode,
          timestamp: new Date()
        };

        // Emit to receiver (Room-based relay for multi-tab support)
        io.to(receiver_anonymous_id).emit('receive_message', formattedMessage);

        // Acknowledge sending to sender
        socket.emit('message_sent', formattedMessage);

      } catch (err) {
        logger.error('Socket send_message error', { error: err.message });
        socket.emit('message_error', { error: 'Threat detected! hit sos button for help' });
      }
    });

    // 5. Faculty Broadcast Messaging (Department Restricted)
    socket.on('broadcast_message', async (data) => {
      const { message, department } = data;
      const targetDept = department || socket.department;

      if (!targetDept) {
        return socket.emit('message_error', { error: 'Department target missing for broadcast.' });
      }

      // BUG-019 FIX: faculty, admin, super_admin match actual DB ENUM values
      const canBroadcast = socket.role === ROLES.FACULTY ||
        socket.role === ROLES.ADMIN ||
        socket.role === ROLES.SUPER_ADMIN;

      if (!canBroadcast) {
        return socket.emit('message_error', { error: 'Unauthorized to broadcast messages.' });
      }

      logger.audit(AUDIT_ACTIONS.MESSAGE_SENT, {
        sender: socket.anonymousId,
        action: 'FACULTY_BROADCAST',
        department: targetDept
      });

      // 1. Store in DB for persistence (Refresh fix)
      try {
        await communicationService.storeBroadcast(socket.userId, targetDept, message, socket.role);
      } catch (err) {
        logger.error('Failed to persist broadcast', { error: err.message });
      }

      // 2. Emit to department room (normalized to lowercase)
      io.to(`dept_${targetDept.toLowerCase()}`).emit('system_broadcast', {
        sender_anonymous_id: socket.anonymousId,
        sender_role: socket.role,
        message,
        timestamp: new Date()
      });

      // Optional: Store in DB with is_broadcast = TRUE if needed for history
    });

    // 6. Emergency SOS Handler
    socket.on('emergency_sos', async (data) => {
      const { category } = data; // self-harm, harassment, medical

      try {
        // 1. Attach Mood History
        const moodHistory = await communicationService.getRecentMoodHistory(socket.userId, 5);

        // storeSOSRecord inserts with student_id (BUG-015 FIX applied in communication.service.js)
        // category, severity, attached_mood_data all exist per migration schema (line 73-77)
        const sosId = await communicationService.storeSOSRecord(socket.userId, `Emergency: ${category}`);
        // Category values map karo ENUM se match karne ke liye
        const categoryMap = {
          'self-harm': 'mental_health',
          'harassment': 'harassment',
          'medical': 'other',
          'mental_health': 'mental_health',
          'academic': 'academic'
        };
        const safeCategory = categoryMap[category] || 'other';

        await query(
          'UPDATE sos_records SET category = ?, severity = "high", attached_mood_data = ? WHERE id = ?',
          [safeCategory, JSON.stringify(moodHistory), sosId]
        );

        logger.audit(AUDIT_ACTIONS.SOS_TRIGGERED, {
          sender: socket.anonymousId,
          category,
          sos_id: sosId
        });

        // Notify Admins Real-time
        io.to('admin_room').emit('admin:new_sos', {
          id: sosId,
          anonymous_id: socket.anonymousId,
          category,
          severity: 'HIGH',
          status: 'pending',
          timestamp: new Date()
        });

        // Real-time Dashboard Stats Update
        const stats = await adminService.getPlatformStats();
        io.to('admin_room').emit('admin:stats', stats);

        // 3. Smart Routing - Tiered Escalation
        const department = socket.department;
        const authorities = await communicationService.getDepartmentFaculty(department);

        // Filter authorities by role and online status
        const onlineCounselors = authorities.filter(a => a.role === ROLES.COUNSELOR_ADMIN && userSockets.has(a.anonymous_id));
        const onlineDeptAdmins = authorities.filter(a => a.role === ROLES.DEPT_ADMIN && userSockets.has(a.anonymous_id));

        const emergencyRoom = `emergency_${sosId}`;
        socket.join(emergencyRoom);

        let dispatchedTo = [];

        if (onlineCounselors.length > 0) {
          // Tier 1: Counselors
          onlineCounselors.forEach(c => {
            const socketId = userSockets.get(c.anonymous_id);
            io.to(socketId).emit('sos_alert', {
              sos_id: sosId,
              student_anonymous_id: socket.anonymousId,
              category,
              mood_context: moodHistory,
              room_id: emergencyRoom
            });
            dispatchedTo.push(c.anonymous_id);
          });
        } else if (onlineDeptAdmins.length > 0) {
          // Tier 2: Dept Admins
          onlineDeptAdmins.forEach(da => {
            const socketId = userSockets.get(da.anonymous_id);
            io.to(socketId).emit('sos_alert', {
              sos_id: sosId,
              student_anonymous_id: socket.anonymousId,
              category,
              mood_context: moodHistory,
              room_id: emergencyRoom
            });
            dispatchedTo.push(da.anonymous_id);
          });
        } else {
          // Tier 3: Global Admin Room Fallback
          io.to('admin_room').emit('sos_alert', {
            sos_id: sosId,
            student_anonymous_id: socket.anonymousId,
            category,
            mood_context: moodHistory,
            room_id: emergencyRoom,
            fallback: true
          });
          dispatchedTo.push('admin_room');
        }

        logger.info(`SOS ${sosId} dispatched to: ${dispatchedTo.join(', ')}`);
        socket.emit('sos_dispatched', { sos_id: sosId, message: 'Help is on the way. Specialized support has been notified.' });

      } catch (err) {
        logger.error('Failed to process SOS', { error: err.message });
        socket.emit('message_error', { error: 'Critical failure during SOS dispatch.' });
      }
    });

    // 8. Academic Board Events
    socket.on('academic:offer_help', async (data) => {
      try {
        const { request_id } = data;
        const academicService = require('../modules/academic/academic.service');
        await academicService.initiateHelperChat(request_id, socket.userId);
        logger.info(`Academic help offered by ${socket.anonymousId} for request ${request_id}`);
      } catch (err) {
        logger.error('academic:offer_help error', { error: err.message });
        socket.emit('academic:error', { message: err.message });
      }
    });

    socket.on('academic:resolve_request', async (data) => {
      try {
        const { request_id, rating } = data;
        const academicService = require('../modules/academic/academic.service');
        await academicService.resolveRequest(request_id, rating);
        logger.info(`Academic request ${request_id} resolved with rating ${rating}`);
      } catch (err) {
        logger.error('academic:resolve_request error', { error: err.message });
        socket.emit('academic:error', { message: err.message });
      }
    });

    socket.on('join_emergency', (data) => {
      const { room_id } = data;
      const isAdmin = [ROLES.FACULTY, ROLES.COUNSELOR_ADMIN, ROLES.DEPT_ADMIN, ROLES.ADMIN, ROLES.SUPER_ADMIN].includes(socket.role);

      if (isAdmin) {
        socket.join(room_id);
        io.to(room_id).emit('peer_joined', { anonymous_id: socket.anonymousId, role: socket.role });
      }
    });

    // ─── Trust & Badge Events ──────────────────────────────────────────
    socket.on('trust:get_badge', async () => {
      try {
        const trustService = require('../modules/trust/trust.service');
        const badge = await trustService.getUserBadge(socket.userId);
        socket.emit('trust:badge_data', badge);
      } catch (err) {
        logger.error('trust:get_badge error', { error: err.message });
      }
    });

    socket.on('trust:get_history', async () => {
      try {
        const trustService = require('../modules/trust/trust.service');
        const history = await trustService.getTrustHistory(socket.userId);
        socket.emit('trust:history_data', history);
      } catch (err) {
        logger.error('trust:get_history error', { error: err.message });
      }
    });

    socket.on('disconnect', (reason) => {
      logger.info('Socket disconnected', { socketId: socket.id, reason });
      userSockets.delete(socket.anonymousId);
    });
  });

  logger.info('✓ Socket.io initialised with Security, E2E placeholder, and Moderation Pipelines');
  return io;
}

function getIO() {
  if (!io) {
    logger.warn('Socket.io not initialised — call initSocket() first');
  }
  return io;
}

/** Allow other modules to resolve a socket id from an anonymous_id */
function getUserSockets() {
  return userSockets;
}

module.exports = { initSocket, getIO, getUserSockets };
