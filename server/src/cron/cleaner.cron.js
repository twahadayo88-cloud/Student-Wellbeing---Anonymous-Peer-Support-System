const cron = require('node-cron');
const { query } = require('../config/db.config');
const logger = require('../utils/logger');
const env = require('../config/env.config');
const noticesService = require('../modules/notices/notices.service');

/**
 * PeerBridge — Cleaner Crons
 * ===========================
 * Handles GDPR-style data minimization, account purges, and offer-window enforcement.
 */

function initCronJobs() {
  // ─── 0. Academic Offer Expiry (Every 1 minute) ─────────────────────────────
  // Enforces the 15-minute offer window for academic help chat_requests.
  // On expiry, records the timed-out helper as excluded and cascades to the
  // next-best eligible helper (Prompt 1 Follow-up Item 1).
  cron.schedule('* * * * *', async () => {
    try {
      const [expiredOffers] = await query(`
        SELECT cr.id, cr.receiver_id, cr.academic_request_id
        FROM chat_requests cr
        WHERE cr.status = 'pending'
          AND cr.expires_at < NOW()
          AND cr.academic_request_id IS NOT NULL
      `);

      if (!expiredOffers.length) return;

      for (const offer of expiredOffers) {
        try {
          const [expireResult] = await query(
            'UPDATE chat_requests SET status = "expired" WHERE id = ? AND status = "pending"',
            [offer.id]
          );
          if (!expireResult.affectedRows) continue;

          await query(`
            UPDATE academic_requests
            SET status = 'open', matched_helper_id = NULL, matched_at = NULL
            WHERE id = ? AND status = 'matched' AND matched_at IS NULL
          `, [offer.academic_request_id]);

          try {
            await query(
              'INSERT IGNORE INTO chat_offer_exclusions (academic_request_id, helper_user_id) VALUES (?, ?)',
              [offer.academic_request_id, offer.receiver_id]
            );
          } catch (exclErr) {
            logger.error('offer-expiry cron: exclusion insert failed — skipping cascade', {
              chatRequestId: offer.id,
              academicRequestId: offer.academic_request_id,
              error: exclErr.message
            });
            continue;
          }

          let excludedIds = [];
          try {
            const [excRows] = await query(
              'SELECT helper_user_id FROM chat_offer_exclusions WHERE academic_request_id = ?',
              [offer.academic_request_id]
            );
            excludedIds = excRows.map(r => Number(r.helper_user_id));
          } catch (readErr) {
            logger.error('offer-expiry cron: exclusion read failed — skipping cascade', {
              academicRequestId: offer.academic_request_id,
              error: readErr.message
            });
            continue;
          }

          const academicService = require('../modules/academic/academic.service');
          await academicService._offerToNextHelper(offer.academic_request_id, excludedIds);
          logger.info(`offer-expiry cron: cascaded chatRequestId=${offer.id} academicRequestId=${offer.academic_request_id}`);
        } catch (offerErr) {
          logger.error('offer-expiry cron: per-offer processing failed', { id: offer.id, error: offerErr.message });
        }
      }
    } catch (err) {
      logger.error('offer-expiry cron: top-level failure', { error: err.message });
    }
  });


  // ─── 1. Data Minimization CRON (Daily at 2AM) ──────────────
  // Deletes messages where expires_at < NOW() and is_flagged = FALSE
  cron.schedule('0 2 * * *', async () => {
    logger.info('Starting daily data minimization cron job');
    try {
      const [result] = await query(`
        DELETE FROM chat_messages 
        WHERE expires_at < NOW() 
          AND is_flagged = 0
      `);
      if (result.affectedRows > 0) {
        logger.audit('DATA_MINIMIZATION', {
          action: 'DAILY_MESSAGE_PURGE',
          recordsDeleted: result.affectedRows
        });
      }
    } catch (err) {
      logger.error('Failed to run daily data minimization cron', { error: err.message });
    }
  });

  // ─── 2. Account Deletion & Warning System (Hourly) ───────────────────
  cron.schedule('0 * * * *', async () => {
    logger.info('Starting hourly account maintenance cron job');
    try {
      const { sendDeletionWarningEmail } = require('../utils/email');

      const [warningUsers] = await query(`
        SELECT id, email FROM users 
        WHERE deletion_scheduled_at IS NOT NULL 
          AND deletion_warning_sent_at IS NULL
          AND deletion_scheduled_at < DATE_ADD(NOW(), INTERVAL 24 HOUR)
      `);

      const cancelLink = `${env.clientUrl}/profile`;

      for (const wu of warningUsers) {
        await sendDeletionWarningEmail(wu.email, cancelLink);
        await query('UPDATE users SET deletion_warning_sent_at = NOW() WHERE id = ?', [wu.id]);
        logger.info(`Sent account deletion warning to ${wu.email}`);
      }

      // B. Hard delete users where scheduled time has passed
      const [users] = await query(`
        SELECT id FROM users 
        WHERE deletion_scheduled_at < NOW()
      `);

      if (users.length > 0) {
        const userIds = users.map(u => u.id);
        logger.audit('ACCOUNT_PURGE_STARTED', { action: 'GDPR_HARD_DELETE', targetCount: userIds.length });

        for (const uid of userIds) {
          // Cascading deletes handled by DB
          await query('DELETE FROM users WHERE id = ?', [uid]);
        }
        logger.audit('ACCOUNT_PURGE_COMPLETED', { action: 'GDPR_HARD_DELETE_COMPLETE', recordsDeleted: userIds.length });
      }

      // C. Auto-expire Chat Requests (Pending > 48h)
      const [expiredChat] = await query(`
        UPDATE chat_requests 
        SET status = 'expired' 
        WHERE status = 'pending' AND expires_at < NOW()
      `);
      if (expiredChat.affectedRows > 0) {
        logger.info(`Auto-expired ${expiredChat.affectedRows} chat requests`);
      }

      const [reopenedAcademic] = await query(`
        UPDATE academic_requests ar
        JOIN chat_requests cr ON cr.academic_request_id = ar.id
        SET ar.status = 'open', ar.matched_helper_id = NULL, ar.matched_at = NULL
        WHERE cr.status = 'expired' AND ar.status = 'matched' AND ar.matched_at IS NULL
      `);
      if (reopenedAcademic.affectedRows > 0) {
        const { getIO } = require('../config/socket.config');
        const io = getIO();
        if (io) io.emit('academic:requests_refresh');
      }

    } catch (err) {
      logger.error('Failed to run account maintenance cron', { error: err.message });
    }
  });

  // ─── 3. Sunday Midnight: Rotate Anonymous IDs (GDPR Compliance) ──────────────
  cron.schedule('0 0 * * 0', async () => {
    logger.info('Starting weekly anonymous ID rotation');
    try {
      const crypto = require('crypto');
      const ADJECTIVES = ['Silent', 'Brave', 'Clever', 'Calm', 'Swift', 'Gentle', 'Fierce', 'Noble', 'Wise', 'Bright'];
      const ANIMALS = ['Falcon', 'Wolf', 'Bear', 'Owl', 'Fox', 'Stag', 'Hawk', 'Lion', 'Tiger', 'Eagle'];

      const generateNewId = () => {
        const adj = ADJECTIVES[crypto.randomInt(0, ADJECTIVES.length)];
        const animal = ANIMALS[crypto.randomInt(0, ANIMALS.length)];
        const num = crypto.randomInt(1000, 10000);
        return `${adj}${animal}#${num}`;
      };

      // Fetch all student profiles
      const [profiles] = await query(`
        SELECT p.user_id, p.anonymous_id 
        FROM profiles p
        JOIN users u ON p.user_id = u.id
        WHERE u.role = 'student'
      `);

      for (const p of profiles) {
        const newId = generateNewId();
        
        // 1. Store in history
        await query(
          'INSERT INTO anonymous_id_history (user_id, old_anonymous_id, new_anonymous_id) VALUES (?, ?, ?)',
          [p.user_id, p.anonymous_id, newId]
        );

        // 2. Update profile
        await query('UPDATE profiles SET anonymous_id = ? WHERE user_id = ?', [newId, p.user_id]);
      }

      logger.info(`Rotated IDs for ${profiles.length} students`);
    } catch (err) {
      logger.error('Failed to rotate anonymous IDs', { error: err.message });
    }
  });

  // ─── 5. GDPR Cleanup (Daily at 3AM) ──────────────
  cron.schedule('0 3 * * *', async () => {
    logger.info('Starting GDPR cleanup tasks');
    try {
      // A. Posts auto-delete after 90 days (non-flagged)
      // Assuming 'posts' table exists (Academic Support Board / Community Notice Board)
      const tables = ['academic_requests', 'notice_posts', 'library_uploads'];
      for (const table of tables) {
        try {
          let queryStr = `
            DELETE FROM ${table} 
            WHERE created_at < DATE_SUB(NOW(), INTERVAL 90 DAY)
          `;
          if (table === 'academic_requests') {
            queryStr += ` AND ai_moderation_status = 'clean'`;
          } else {
            queryStr += ` AND (is_flagged = 0 OR is_flagged IS NULL)`;
          }
          const [res] = await query(queryStr);
          if (res.affectedRows > 0) logger.info(`Purged ${res.affectedRows} records from ${table}`);
        } catch (e) {
          // Table might not exist yet or different schema, ignore for now but log
          logger.warn(`Cleanup failed for table ${table}: ${e.message}`);
        }
      }

      // B. Moderation queue cleared after 6 months
      const [modRes] = await query('DELETE FROM moderation_queue WHERE created_at < DATE_SUB(NOW(), INTERVAL 6 MONTH)');
      if (modRes.affectedRows > 0) logger.info(`Cleared ${modRes.affectedRows} items from moderation queue`);

      // C. Chat logs auto-delete after 30 days (already handled in task 1, but ensuring consistency)
      // Task 1 already handles chat_messages based on expires_at.

    } catch (err) {
      logger.error('Failed GDPR cleanup', { error: err.message });
    }
  });

  // ─── 6. Academic Support Board: Maintenance ──────────────
  cron.schedule('15 * * * *', async () => {
    try {
      await noticesService.expireAndRemind();
    } catch (err) {
      logger.error('Notice expiry/reminder job failed', { error: err.message });
    }
  });

  cron.schedule('*/15 * * * *', async () => {
    try {
      await noticesService.recalculateTrending();
    } catch (err) {
      logger.error('Notice trending recalculation failed', { error: err.message });
    }
  });

  // ─── 7. Academic Support Board: Maintenance ──────────────
  // Auto-close resolved requests after 48 hours
  cron.schedule('0 * * * *', async () => {
    logger.info('Starting academic auto-close cron');
    try {
      const [result] = await query(`
        UPDATE academic_requests 
        SET status = 'closed', closed_at = NOW()
        WHERE status = 'resolved' 
        AND resolved_at < DATE_SUB(NOW(), INTERVAL 48 HOUR)
      `);
      if (result.affectedRows > 0) logger.info(`Auto-closed ${result.affectedRows} academic requests`);
    } catch (err) {
      logger.error('Failed academic auto-close cron', { error: err.message });
    }
  });

  // Reset daily post counter midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('Starting academic daily reset cron');
    try {
      await query(
        'DELETE FROM daily_post_tracker WHERE post_date < DATE_SUB(CURDATE(), INTERVAL 7 DAY)'
      );
    } catch (err) {
      logger.error('Failed academic daily reset cron', { error: err.message });
    }
  });

  // ─── 8. Trust Score & Leaderboard Maintenance ──────────────
  // Daily Trust Score Recalculation (Midnight)
  cron.schedule('0 0 * * *', async () => {
    logger.info('Starting daily trust score recalculation');
    try {
      const trustService = require('../modules/trust/trust.service');
      const [users] = await query('SELECT id FROM users WHERE role = "student" AND deletion_scheduled_at IS NULL');
      for (const user of users) {
        await trustService.recalculateTrustScore(user.id);
      }
      logger.info(`Trust scores recalculated for ${users.length} users`);
    } catch (err) {
      logger.error('Trust score recalculation failed', { error: err.message });
    }
  });

  // Weekly Leaderboard Update (Sunday Midnight)
  cron.schedule('0 0 * * 0', async () => {
    logger.info('Starting weekly leaderboard update');
    try {
      const trustService = require('../modules/trust/trust.service');
      await trustService.updateMonthlyLeaderboard();
      logger.info('Monthly leaderboard updated successfully');
    } catch (err) {
      logger.error('Leaderboard update failed', { error: err.message });
    }
  });

  logger.info('✓ Cleaner cron jobs registered');
}

module.exports = { initCronJobs };
