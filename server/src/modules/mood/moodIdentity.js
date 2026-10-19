const crypto = require('crypto');
const env = require('../../config/env.config');

function getMoodSubjectId(userId) {
  return crypto
    .createHmac('sha256', env.moodDataSecret)
    .update(`peerbridge:mood:${userId}`)
    .digest('hex');
}

module.exports = { getMoodSubjectId };
