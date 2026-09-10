const { query } = require('../../config/db.config');

async function submitFeedback(fromUserId, toAnonymousId, rating, requestId) {
    if (!requestId) throw new Error('requestId is required for verified feedback');

    // 1. Resolve toUserId
    const [receiverRows] = await query('SELECT user_id FROM profiles WHERE anonymous_id = ?', [toAnonymousId]);
    if (!receiverRows.length) return;
    const toUserId = receiverRows[0].user_id;

    // 2. Validate Request Integrity (Must be accepted and involve both users)
    const [verifyReq] = await query(
        'SELECT id FROM chat_requests WHERE id = ? AND status = "accepted" AND ((sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?))',
        [requestId, fromUserId, toUserId, toUserId, fromUserId]
    );

    if (!verifyReq.length) {
        throw new Error('You can only rate peers from an active, accepted chat session');
    }

    // 3. Duplicate Check (One rating per request)
    const [existing] = await query('SELECT id FROM feedback WHERE from_user = ? AND request_id = ?', [fromUserId, requestId]);
    if (existing.length) {
        throw new Error('You have already provided feedback for this session');
    }

    // 4. Insert feedback
    await query(
        'INSERT INTO feedback (from_user, to_user, rating, request_id) VALUES (?, ?, ?, ?)',
        [fromUserId, toUserId, rating, requestId]
    );

    // 5. Recalculate trust_score for toUserId
    const [avgRows] = await query(
        'SELECT AVG(rating) as avg_rating FROM feedback WHERE to_user = ?',
        [toUserId]
    );

    const avgRating = avgRows[0].avg_rating || 0;
    const newTrustScore = Math.round(avgRating * 20);

    await query(
        'UPDATE profiles SET trust_score = ? WHERE user_id = ?',
        [newTrustScore, toUserId]
    );
}

module.exports = { submitFeedback };
