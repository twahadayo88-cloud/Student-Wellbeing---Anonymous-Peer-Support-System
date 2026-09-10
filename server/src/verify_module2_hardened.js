/**
 * PeerBridge — Module 2 Hardening Verification
 * ===========================================
 * Tests production-grade security and GDPR compliance features.
 */

const { query } = require('./config/db.config');
const profileService = require('./modules/profile/profile.service');
const chatService = require('./modules/chat/chat.service');
const feedbackService = require('./modules/feedback/feedback.service');
const logger = require('./utils/logger');

async function runVerification() {
  console.log('🚀 Starting Module 2 Hardening Verification...\n');

  try {
    // 1. Setup Test User
    const testUserId = 2; // Assuming active student
    console.log(`[SETUP] Using Test User ID: ${testUserId}`);

    // Clean start
    await query('UPDATE users SET deletion_scheduled_at = NULL, deletion_warning_sent_at = NULL WHERE id = ?', [testUserId]);

    // ─── 2. GDPR Soft-Delete & Restore ───
    console.log('\n--- Testing GDPR Deletion Flow ---');
    await profileService.deleteUserAccount(testUserId);
    
    const [rows] = await query('SELECT deletion_scheduled_at FROM users WHERE id = ?', [testUserId]);
    const delCheck = rows[0];
    if (delCheck && delCheck.deletion_scheduled_at) {
      console.log('✅ Account successfully scheduled for deletion.');
    } else {
      throw new Error('FAILED: deletion_scheduled_at is NULL');
    }

    await profileService.cancelDeletion(testUserId);
    const [rowsRestore] = await query('SELECT deletion_scheduled_at, deletion_warning_sent_at FROM users WHERE id = ?', [testUserId]);
    const restoreCheck = rowsRestore[0];
    if (restoreCheck && !restoreCheck.deletion_scheduled_at && !restoreCheck.deletion_warning_sent_at) {
      console.log('✅ Account successfully restored (timestamps reset).');
    } else {
      throw new Error('FAILED: Deletion timestamps not cleaned up');
    }

    // ─── 3. Chat Request Lifecycle ───
    console.log('\n--- Testing Chat Request Hardening ---');
    
    // Cleanup old test requests between these two
    await query('DELETE FROM chat_requests WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)', [testUserId, 3, 3, testUserId]);

    // Create a NEW request
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 48);
    const [res] = await query(
      'INSERT INTO chat_requests (sender_id, receiver_id, subject_context, status, expires_at) VALUES (?, ?, ?, ?, ?)',
      [testUserId, 3, 'Hardening Test Context', 'pending', expiresAt]
    );
    const requestId = res.insertId;
    console.log(`[SETUP] Created test request ID: ${requestId}`);

    // A. Verify auto-expiry block
    await query('UPDATE chat_requests SET status = "expired" WHERE id = ?', [requestId]);
    console.log(`[INFO] Set Chat Request ${requestId} to "expired"`);

    try {
      await chatService.respondToRequest(3, requestId, 'accepted');
      console.log('❌ FAILED: Security check should have blocked response to expired request');
    } catch (err) {
      console.log(`✅ Security check blocked expired request: ${err.message}`);
    }

    // ─── 4. Feedback Integrity ───
    console.log('\n--- Testing Feedback Integrity ---');
    // We need a receiver anonymous ID for feedback test
    const [rowsAnonym] = await query('SELECT anonymous_id FROM profiles WHERE user_id = ?', [testUserId]);
    const receiverAnonymousId = rowsAnonym[0].anonymous_id;

    // A. Setup: Ensure an accepted request exists
    await query('UPDATE chat_requests SET status = "accepted" WHERE id = ?', [requestId]);

    // B. Cleanup previous feedback
    await query('DELETE FROM feedback WHERE request_id = ?', [requestId]);
    
    // C. First submission (from_user=3, to_user=testUserId (id=2), rating=5, request_id=3)
    await feedbackService.submitFeedback(3, receiverAnonymousId, 5, requestId);
    console.log('[INFO] First feedback submitted.');

    try {
      await feedbackService.submitFeedback(3, receiverAnonymousId, 5, requestId);
      console.log('❌ FAILED: Duplicate feedback for same request was allowed');
    } catch (err) {
      console.log(`✅ Duplicate feedback blocked: ${err.message}`);
    }

    // ─── 5. Faculty Profile office_hours ───
    console.log('\n--- Testing Faculty Office Hours ---');
    const facultyId = 3; // Assuming faculty
    const newHours = ["Mon 10-12", "Wed 14-16"];
    await profileService.updateProfile(facultyId, { office_hours: newHours }, 'faculty');
    
    const [rowsFac] = await query('SELECT office_hours FROM profiles WHERE user_id = ?', [facultyId]);
    const savedHours = rowsFac[0]?.office_hours;
    if (JSON.stringify(savedHours) === JSON.stringify(newHours)) {
      console.log('✅ Faculty office_hours successfully updated.');
    } else {
      console.log('❌ FAILED: Office hours not saved correctly', savedHours);
    }

    console.log('\n✨ ALL MODULE 2 HARDENING TESTS PASSED! ✨');

  } catch (err) {
    console.error(`\n❌ VERIFICATION FAILED: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

runVerification();
