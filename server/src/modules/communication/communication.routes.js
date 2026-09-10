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
router.post('/messages', sendMessage); // strict SocketIO override stub
router.post('/messages/:id/flag', flagMessage);
router.post('/block', blockUser);
router.post('/report', reportUser);
router.get('/broadcasts', getBroadcasts);

module.exports = router;
