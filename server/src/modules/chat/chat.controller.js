const asyncHandler = require('../../utils/asyncHandler');
const { HTTP_STATUS } = require('../../utils/constants');
const chatService = require('./chat.service');
const { getIO } = require('../../config/socket.config');
const { query } = require('../../config/db.config');

const createRequest = asyncHandler(async (req, res) => {
  const senderId = req.user.user_id;
  const { receiver_anonymous_id, subject_context } = req.body;

  const requestId = await chatService.createChatRequest(senderId, receiver_anonymous_id, subject_context);

  // Fetch sender's anonymous_id for the push event
  const [senderRows] = await query('SELECT anonymous_id FROM profiles WHERE user_id = ?', [senderId]);
  const senderAnonymousId = senderRows[0]?.anonymous_id || 'Unknown';

  // Fetch expiry for the payload
  const [reqRows] = await query('SELECT expires_at FROM chat_requests WHERE id = ?', [requestId]);
  const expiresAt = reqRows[0]?.expires_at;

  // Push real-time notification to the receiver's room (Multi-tab support)
  const io = getIO();
  if (io) {
    io.to(receiver_anonymous_id).emit('chat_request:new', {
      id: requestId,
      sender_anonymous_id: senderAnonymousId,
      subject_context,
      expires_at: expiresAt,
    });
  }

  res.status(HTTP_STATUS.CREATED).json({
    success: true,
    message: 'Chat request sent successfully',
  });
});

const respondToChatRequest = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const { request_id, status } = req.body;

  const request = await chatService.respondToRequest(userId, request_id, status);

  // Resolve anonymous IDs for both parties
  const [receiverRows] = await query('SELECT anonymous_id FROM profiles WHERE user_id = ?', [userId]);
  const [senderRows] = await query('SELECT anonymous_id FROM profiles WHERE user_id = ?', [request.sender_id]);
  const receiverAnonymousId = receiverRows[0]?.anonymous_id;
  const senderAnonymousId = senderRows[0]?.anonymous_id;

  // Push real-time event to the original sender and refresh conversations
  const io = getIO();
  
  if (io) {
    const event = status === 'accepted' ? 'chat_request:accepted' : 'chat_request:declined';
    
    if (senderAnonymousId) {
      io.to(senderAnonymousId).emit(event, {
        request_id,
        receiver_anonymous_id: receiverAnonymousId,
        status,
      });
    }

    // NEW: Real-time update for "Active Chats" list on BOTH sides via rooms
    if (status === 'accepted') {
      if (senderAnonymousId) io.to(senderAnonymousId).emit('conversation:refresh');
      if (receiverAnonymousId) io.to(receiverAnonymousId).emit('conversation:refresh');
    }

    if (request.academic_request_id) {
      io.emit('academic:request_updated', {
        request_id: request.academic_request_id,
        status: status === 'accepted' ? 'in_progress' : 'open'
      });
    }
  }

  res.status(HTTP_STATUS.OK).json({
    success: true,
    message: `Chat request ${status}`,
    data: { status }
  });
});

const getPendingRequests = asyncHandler(async (req, res) => {
  const userId = req.user.user_id;
  const data = await chatService.getPendingRequests(userId);

  res.status(HTTP_STATUS.OK).json({
    success: true,
    data
  });
});

module.exports = { createRequest, respondToChatRequest, getPendingRequests };
