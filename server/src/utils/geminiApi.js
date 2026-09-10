const { query } = require('../config/db.config');
const logger = require('./logger');

/**
 * geminiApi.js — Rule-based pattern detection
 * Analyzes patterns across multiple messages/actions.
 */
async function analyzeContext(userId, timeWindowHours = 24) {
  try {
    // 1. Fetch recent activity (last 24 hours)
    // We check chat_messages and reports
    const [messages] = await query(`
      SELECT id, receiver_id, is_flagged 
      FROM chat_messages 
      WHERE sender_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
    `, [userId, timeWindowHours]);

    const [moods] = await query(`
      SELECT mood_score 
      FROM mood_entries 
      WHERE user_id = ? AND created_at > DATE_SUB(NOW(), INTERVAL ? HOUR)
      ORDER BY created_at DESC LIMIT 3
    `, [userId, timeWindowHours]);

    const flaggedCount = messages.filter(m => m.is_flagged).length;
    
    // Check targeting (10+ messages to same receiver)
    const receiverCounts = {};
    messages.forEach(m => {
      receiverCounts[m.receiver_id] = (receiverCounts[m.receiver_id] || 0) + 1;
    });
    const maxMessagesToSamePeer = Math.max(0, ...Object.values(receiverCounts));

    // Check distress pattern (3+ consecutive low mood)
    const isDistressed = moods.length >= 3 && moods.every(m => m.mood_score <= 2);

    let riskLevel = 'LOW';
    let patternDetected = 'none';
    let recommendation = 'Continue monitoring';

    if (flaggedCount >= 4) {
      riskLevel = 'HIGH';
      patternDetected = 'repeated_harassment';
      recommendation = 'Immediate account review required';
    } else if (maxMessagesToSamePeer >= 9) {
      riskLevel = 'MEDIUM';
      patternDetected = 'targeting';
      recommendation = 'Check for potential harassment or spam';
    } else if (isDistressed) {
      riskLevel = 'MEDIUM';
      patternDetected = 'distress_pattern';
      recommendation = 'Trigger proactive wellness check-in';
    }

    return {
      risk_level: riskLevel,
      pattern_detected: patternDetected,
      recommendation
    };
  } catch (err) {
    logger.error('Context analysis failed', { error: err.message });
    return { risk_level: 'LOW', pattern_detected: 'error', recommendation: 'Error during analysis' };
  }
}

module.exports = {
  analyzeContext
};
