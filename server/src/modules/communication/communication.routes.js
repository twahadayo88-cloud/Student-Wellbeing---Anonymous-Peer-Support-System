const { Router } = require('express');
const { protect } = require('../../middleware/auth.middleware');
const {
  getConversations,
  getMessages,
  sendMessage,
  flagMessage,
  blockUser,
  reportUser,
  getBroadcasts
} = require('./communication.controller');

const router = Router();

router.use(protect);

router.get('/conversations', getConversations);
router.get('/conversations/:id/messages', getMessages);
// ARCHITECTURE NOTE (Prompt 1, Task 2):
// All chat messages must be sent via Socket.io `send_message` — this REST endpoint
// is intentionally a rejecting stub (returns HTTP 400) to surface misconfigured clients.
// No client code calls this endpoint. Do not implement REST message-sending here.
router.post('/messages', sendMessage);
router.post('/messages/:id/flag', flagMessage);
router.post('/block', blockUser);
router.post('/report', reportUser);
router.get('/broadcasts', getBroadcasts);

module.exports = router;
