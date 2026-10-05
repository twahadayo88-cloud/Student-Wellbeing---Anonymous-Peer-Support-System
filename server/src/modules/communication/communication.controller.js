const asyncHandler = require('../../utils/asyncHandler');
const { HTTP_STATUS, AUDIT_ACTIONS } = require('../../utils/constants');
const AppError = require('../../utils/AppError');
const logger = require('../../utils/logger');
const communicationService = require('./communication.service');
const profileService = require('../profile/profile.service');

const getConversations = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;

  const conversations = await communicationService.getUserConversations(userId);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: conversations,
  });
});

const getMessages = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const conversationId = req.params.id;

  if (!conversationId) {
    throw AppError.badRequest('Conversation ID is required');
  }

  const messages = await communicationService.getConversationMessages(userId, conversationId);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data: messages,
  });
});

const blockUser = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const { anonymous_id } = req.body;
  if (!anonymous_id) throw AppError.badRequest('Peer anonymous ID is required');

  const peerUserId = await communicationService.getUserIdByAnonymousId(anonymous_id);
  if (!peerUserId) throw AppError.notFound('User not found');

  await communicationService.blockUser(userId, peerUserId);
  logger.audit(AUDIT_ACTIONS.ADMIN_ACTION, { action: 'USER_BLOCKED', blocker: userId, blocked: peerUserId });

  res.status(HTTP_STATUS.OK).json({ success: true, message: 'User blocked successfully' });
});

const reportUser = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const { anonymous_id, reason } = req.body;
  if (!anonymous_id || !reason) throw AppError.badRequest('Peer anonymous ID and reason are required');

  const peerUserId = await communicationService.getUserIdByAnonymousId(anonymous_id);
  if (!peerUserId) throw AppError.notFound('User not found');

  await communicationService.reportUser(userId, peerUserId, reason);
  logger.audit(AUDIT_ACTIONS.MESSAGE_FLAGGED, { action: 'USER_REPORTED', reporter: userId, reported: peerUserId, reason });

  res.status(HTTP_STATUS.CREATED).json({ success: true, message: 'Report submitted successfully' });
});

/**
 * ARCHITECTURE DECISION — Prompt 1, Task 2
 * This endpoint is an explicit Socket.io-redirect stub.
 * The single supported message-send path is the authenticated Socket.io `send_message` event.
 * Clients that call this REST endpoint receive HTTP 400 as a clear misconfiguration signal.
 * Do NOT implement REST message persistence here; that would bypass the abuse-detection
 * and student-to-student enforcement in socket.config.js → send_message handler.
 */
const sendMessage = asyncHandler(async (req, res) => {
  res.status(HTTP_STATUS.BAD_REQUEST).json({
    success: false,
    message: 'Please transmit real-time messages via the dedicated Socket.io `send_message` event.',
  });
});

const flagMessage = asyncHandler(async (req, res) => {
  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: 'Manual flagging supported in real-time Socket connection.',
  });
});

const getBroadcasts = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  
  const profile = await profileService.getProfileByUserId(userId);
  if (!profile || !profile.department) {
    return res.status(HTTP_STATUS.OK).json({ success: true, data: [] });
  }

  const broadcasts = await communicationService.getDepartmentBroadcasts(profile.department);

  return res.status(HTTP_STATUS.OK).json({
    success: true,
    data: broadcasts,
  });
});

module.exports = { 
  getConversations, 
  getMessages, 
  sendMessage, 
  flagMessage, 
  blockUser, 
  reportUser,
  getBroadcasts
};
