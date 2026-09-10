const { Router } = require('express');
const { protect } = require('../../middleware/auth.middleware');
const { createRequest, respondToChatRequest, getPendingRequests } = require('./chat.controller');

const router = Router();
router.use(protect);

router.get('/pending', getPendingRequests);
router.post('/request', createRequest);
router.post('/respond', respondToChatRequest);

module.exports = router;
