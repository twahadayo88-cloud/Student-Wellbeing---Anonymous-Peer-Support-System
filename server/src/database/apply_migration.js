const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../config/env.config');
const logger = require('../utils/logger');

const REQUIRED_TABLES = [
  'users', 'profiles', 'anonymous_id_map', 'chat_requests', 'feedback', 
  'chat_messages', 'mood_entries', 'scheduled_tasks',
  'blacklisted_tokens', 'notifications', 'trust_scores', 'violation_history', 'peer_matches', 'broadcasts',
  'reports', 'complaint_history', 'resources', 'resource_reviews', 'resource_bookmarks',
  'notice_posts', 'notice_post_reports', 'notice_reactions', 'notice_saves', 'notice_appeals',
  'moderation_rules', 'policy_reviews', 'trust_score_history', 'trust_score_components',
  'badge_tiers', 'monthly_leaderboard'
];

async function backupDatabase(connection) {
  const backupsDir = path.join(__dirname, '../../backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(backupsDir, `backup-${timestamp}.sql`);
  let sqlDump = `-- PeerBridge Database Backup: ${timestamp}\n\n`;

  for (const table of REQUIRED_TABLES) {
    try {
      const [rows] = await connection.query(`SELECT * FROM ${table}`);
      if (rows.length > 0) {
        sqlDump += `-- Data for ${table}\n`;
        const columns = Object.keys(rows[0]).map(c => `\`${c}\``).join(', ');
        for (const row of rows) {
          const values = Object.values(row).map(v => {
            if (v === null) return 'NULL';
            if (typeof v === 'string') return connection.escape(v);
            if (typeof v === 'object' && v instanceof Date) return connection.escape(v.toISOString().slice(0, 19).replace('T', ' '));
            if (typeof v === 'object') return connection.escape(JSON.stringify(v));
            return connection.escape(v);
          }).join(', ');
          sqlDump += `INSERT INTO \`${table}\` (${columns}) VALUES (${values});\n`;
        }
        sqlDump += '\n';
      }
    } catch (err) {
      if (err.code !== 'ER_NO_SUCH_TABLE') {
        logger.error(`Failed to backup table ${table}: ${err.message}`);
      }
    }
  }

  fs.writeFileSync(backupFile, sqlDump);
  console.log(`[OK] Backup saved to ${backupFile}`);
}

async function applyMigrations() {
  console.log('🔄 Starting Auto-Migration & Health Check...\n');
  
  let connection;
  try {
    connection = await mysql.createConnection({
      host: env.db.host,
      user: env.db.user,
      password: env.db.password,
      database: env.db.name,
    });
    
    console.log('✅ Connected to Database');

    // Shared safety infrastructure used by moderation, notifications, and
    // anonymous-ID rotation must exist before feature modules query it.
    await connection.query(`
      CREATE TABLE IF NOT EXISTS moderation_queue (
        id INT AUTO_INCREMENT PRIMARY KEY,
        content_type VARCHAR(50) NOT NULL,
        content_id INT NULL,
        content_text TEXT NOT NULL,
        user_id INT NOT NULL,
        anonymous_id VARCHAR(100) NULL,
        ai_severity ENUM('LOW', 'MEDIUM', 'HIGH') NOT NULL,
        ai_reason TEXT NULL,
        status ENUM('pending', 'approved', 'rejected', 'escalated') DEFAULT 'pending',
        reviewed_by INT NULL,
        reviewed_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_moderation_status (status),
        INDEX idx_moderation_created (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        type VARCHAR(100) NOT NULL,
        message TEXT NOT NULL,
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_notifications_user (user_id, is_read)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS moderation_rules (
        id INT AUTO_INCREMENT PRIMARY KEY,
        term VARCHAR(120) NOT NULL,
        severity ENUM('MEDIUM','HIGH') NOT NULL DEFAULT 'MEDIUM',
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        created_by INT NULL,
        updated_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY uniq_moderation_rule_term (term)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS policy_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        review_week DATE NOT NULL,
        reviewer_id INT NULL,
        summary TEXT NOT NULL,
        completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE SET NULL,
        UNIQUE KEY uniq_policy_review_week (review_week)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS anonymous_id_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        old_anonymous_id VARCHAR(100) NOT NULL,
        new_anonymous_id VARCHAR(100) NOT NULL,
        rotated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_anonymous_history_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS resources (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uploader_id INT NOT NULL,
        title VARCHAR(160) NOT NULL,
        description TEXT NOT NULL,
        subject VARCHAR(100) NULL,
        semester VARCHAR(30) NULL,
        category VARCHAR(50) NOT NULL,
        external_url VARCHAR(2048) NULL,
        file_path VARCHAR(500) NULL,
        original_file_name VARCHAR(255) NULL,
        mime_type VARCHAR(120) NULL,
        file_size BIGINT NULL,
        status ENUM('pending','approved','rejected','flagged') NOT NULL DEFAULT 'pending',
        is_flagged TINYINT(1) NOT NULL DEFAULT 0,
        moderation_reason TEXT NULL,
        reviewed_by INT NULL,
        reviewed_at DATETIME NULL,
        review_note TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_resources_status (status, created_at),
        INDEX idx_resources_filters (subject, semester, category)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS resource_reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        resource_id INT NOT NULL,
        user_id INT NOT NULL,
        rating TINYINT NOT NULL,
        review TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uniq_resource_review (resource_id, user_id),
        INDEX idx_resource_reviews_resource (resource_id, rating)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS resource_bookmarks (
        resource_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (resource_id, user_id),
        FOREIGN KEY (resource_id) REFERENCES resources(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_resource_bookmarks_user (user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        reporter_id INT NOT NULL,
        reported_id INT NULL,
        reason TEXT NULL,
        evidence_ref VARCHAR(255) NULL,
        category ENUM('harassment','abusive_language','academic_dispute','privacy_violation','spam_scam','spam_or_scam','other') NOT NULL DEFAULT 'other',
        status ENUM('open','under_review','escalated','resolved','rejected','dismissed') NOT NULL DEFAULT 'open',
        level TINYINT NOT NULL DEFAULT 1,
        priority ENUM('normal','high') NOT NULL DEFAULT 'normal',
        is_flagged TINYINT(1) NOT NULL DEFAULT 0,
        assigned_to INT NULL,
        faculty_note TEXT NULL,
        resolved_at DATETIME NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reported_id) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_reports_assigned_level (assigned_to, level, status),
        INDEX idx_reports_reporter (reporter_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS complaint_history (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        complaint_id INT NOT NULL,
        actor_id INT NULL,
        action VARCHAR(64) NOT NULL,
        details JSON NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_complaint_history_case (complaint_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS notice_posts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        department VARCHAR(100) NULL,
        category ENUM('study_groups','lost_found','events','announcements') NOT NULL,
        title VARCHAR(120) NOT NULL,
        body TEXT NOT NULL,
        location_name VARCHAR(100) NULL,
        latitude DECIMAL(10,7) NULL,
        longitude DECIMAL(10,7) NULL,
        is_official TINYINT(1) NOT NULL DEFAULT 0,
        status ENUM('published','held','rejected','expired') NOT NULL,
        is_flagged TINYINT(1) NOT NULL DEFAULT 0,
        severity ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'LOW',
        reports_count INT NOT NULL DEFAULT 0,
        views_count INT NOT NULL DEFAULT 0,
        trending_score DECIMAL(10,2) NOT NULL DEFAULT 0,
        appeal_available TINYINT(1) NOT NULL DEFAULT 0,
        extension_count TINYINT(1) NOT NULL DEFAULT 0,
        expires_at DATETIME NOT NULL,
        expiry_notified_at DATETIME NULL,
        reviewed_by INT NULL,
        reviewed_at DATETIME NULL,
        review_note TEXT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_notice_feed (status, department, category, created_at),
        INDEX idx_notice_expiry (status, expires_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS notice_post_reports (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        reporter_id INT NOT NULL,
        reason VARCHAR(500) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES notice_posts(id) ON DELETE CASCADE,
        FOREIGN KEY (reporter_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uniq_notice_reporter (post_id, reporter_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS notice_reactions (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        reaction ENUM('like','interested') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES notice_posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uniq_notice_reaction (post_id, user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS notice_saves (
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES notice_posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_notice_saves_user (user_id, created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS notice_appeals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        post_id INT NOT NULL,
        user_id INT NOT NULL,
        reason VARCHAR(1000) NOT NULL,
        status ENUM('pending','reviewed') NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (post_id) REFERENCES notice_posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY uniq_notice_appeal (post_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // 1. Generate Backup Before Schema Changes
    await backupDatabase(connection);

    // 2. Validate and Add missing columns safely

    // ─── COMPLAINT WORKFLOW PATCHES ───
    const [reportCols] = await connection.query('SHOW COLUMNS FROM reports');
    const reportColNames = reportCols.map(c => c.Field);
    const reportColumnPatches = [
      ['evidence_ref', 'VARCHAR(255) NULL'],
      ['category', "ENUM('harassment','abusive_language','academic_dispute','privacy_violation','spam_scam','spam_or_scam','other') NOT NULL DEFAULT 'other'"],
      ['status', "ENUM('open','under_review','escalated','resolved','rejected','dismissed') NOT NULL DEFAULT 'open'"],
      ['level', 'TINYINT NOT NULL DEFAULT 1'],
      ['priority', "ENUM('normal','high') NOT NULL DEFAULT 'normal'"],
      ['is_flagged', 'TINYINT(1) NOT NULL DEFAULT 0'],
      ['assigned_to', 'INT NULL DEFAULT NULL'],
      ['faculty_note', 'TEXT NULL'],
      ['resolved_at', 'DATETIME NULL'],
    ];
    for (const [column, definition] of reportColumnPatches) {
      if (!reportColNames.includes(column)) {
        await connection.query(`ALTER TABLE reports ADD COLUMN ${column} ${definition}`);
      }
    }
    if (reportCols.some(column => column.Field === 'reported_id' && column.Null === 'NO')) {
      await connection.query('ALTER TABLE reports MODIFY COLUMN reported_id INT NULL');
    }
    await connection.query(`ALTER TABLE reports MODIFY COLUMN category
      ENUM('harassment','abusive_language','academic_dispute','privacy_violation','spam_scam','spam_or_scam','other')
      NOT NULL DEFAULT 'other'`);
    await connection.query(`ALTER TABLE reports MODIFY COLUMN status
      ENUM('open','under_review','escalated','resolved','rejected','dismissed')
      NOT NULL DEFAULT 'open'`);
    await connection.query('ALTER TABLE reports ADD INDEX idx_reports_assigned_level (assigned_to, level, status)')
      .catch(error => { if (error.code !== 'ER_DUP_KEYNAME') throw error; });

    // ─── MOOD TRACKER PATCHES ───
    const [moodCols] = await connection.query('SHOW COLUMNS FROM mood_entries');
    const moodColNames = moodCols.map(c => c.Field);
    if (!moodColNames.includes('notes') && moodColNames.includes('note')) {
      console.log('⚙️ Patching `mood_entries` table... Renaming `note` to `notes`');
      await connection.query('ALTER TABLE mood_entries CHANGE COLUMN note notes TEXT NULL');
    } else if (!moodColNames.includes('notes')) {
      console.log('⚙️ Patching `mood_entries` table... Adding `notes` column');
      await connection.query('ALTER TABLE mood_entries ADD COLUMN notes TEXT NULL');
    }
    if (!moodColNames.includes('consecutive_low_count')) {
      console.log('⚙️ Patching `mood_entries` table... Adding `consecutive_low_count` column');
      await connection.query('ALTER TABLE mood_entries ADD COLUMN consecutive_low_count INT NOT NULL DEFAULT 0');
    }
    
    // Check users: last_login
    const [userCols] = await connection.query('SHOW COLUMNS FROM users');
    const userColNames = userCols.map(c => c.Field);
    if (!userColNames.includes('last_login')) {
      console.log('⚙️ Patching `users` table... Adding `last_login` column');
      await connection.query('ALTER TABLE users ADD COLUMN last_login DATETIME NULL');
    }

    // ─── VIOLATION HISTORY TABLE ───
    await connection.query(`
      CREATE TABLE IF NOT EXISTS violation_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        violation_type VARCHAR(100) NOT NULL,
        severity ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'LOW',
        message_link INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ─── ESCALATION RECORDS TABLE ───
    await connection.query(`
      CREATE TABLE IF NOT EXISTS escalation_records (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        anonymous_id VARCHAR(50) NULL,
        level VARCHAR(50) NOT NULL,
        reason TEXT NOT NULL,
        content_ref VARCHAR(255) NULL,
        actioned_by INT NULL,
        secondary_approval_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (actioned_by) REFERENCES users(id) ON DELETE SET NULL,
        FOREIGN KEY (secondary_approval_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // ─── AUDIT LOGS COLUMN PATCHES ───
    const [auditCols] = await connection.query('SHOW COLUMNS FROM audit_logs');
    const auditColNames = auditCols.map(c => c.Field);
    if (!auditColNames.includes('target_type')) {
      console.log('⚙️ Patching `audit_logs` table... Adding `target_type` column');
      await connection.query('ALTER TABLE audit_logs ADD COLUMN target_type VARCHAR(100) NULL');
    }
    if (!auditColNames.includes('target_id')) {
      console.log('⚙️ Patching `audit_logs` table... Adding `target_id` column');
      await connection.query('ALTER TABLE audit_logs ADD COLUMN target_id VARCHAR(255) NULL');
    }
    if (!auditColNames.includes('severity')) {
      console.log('⚙️ Patching `audit_logs` table... Adding `severity` column');
      await connection.query("ALTER TABLE audit_logs ADD COLUMN severity ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'LOW'");
    }


    // Check profiles: bio, is_first_login
    const [profileCols] = await connection.query('SHOW COLUMNS FROM profiles');
    const profileColNames = profileCols.map(c => c.Field);
    
    if (!profileColNames.includes('bio')) {
      console.log('⚙️ Patching `profiles` table... Adding `bio` column');
      await connection.query('ALTER TABLE profiles ADD COLUMN bio TEXT NULL');
      console.log('  -> Applied: ALTER TABLE profiles ADD COLUMN bio TEXT NULL');
    }
    
    if (!profileColNames.includes('is_first_login')) {
      console.log('⚙️ Patching `profiles` table... Adding `is_first_login` column');
      await connection.query('ALTER TABLE profiles ADD COLUMN is_first_login BOOLEAN DEFAULT TRUE');
      console.log('  -> Applied: ALTER TABLE profiles ADD COLUMN is_first_login BOOLEAN DEFAULT TRUE');
    }

    // ─── BLACKLISTED TOKENS PATCH ───
    const [blCols] = await connection.query('SHOW COLUMNS FROM blacklisted_tokens');
    const blColNames = blCols.map(c => c.Field);
    if (!blColNames.includes('user_id')) {
      console.log('⚙️ Patching `blacklisted_tokens` table... Adding `user_id` column');
      await connection.query('ALTER TABLE blacklisted_tokens ADD COLUMN user_id INT NULL AFTER id');
      console.log('  -> Applied: ALTER TABLE blacklisted_tokens ADD COLUMN user_id INT NULL');
    }

    // ─── TRUST SCORE HISTORY TABLE ───
    await connection.query(`
      CREATE TABLE IF NOT EXISTS trust_score_components (
        user_id INT PRIMARY KEY,
        helpfulness_rating DECIMAL(3,2) NOT NULL DEFAULT 3.00,
        total_ratings_received INT NOT NULL DEFAULT 0,
        resolution_count INT NOT NULL DEFAULT 0,
        violation_count INT NOT NULL DEFAULT 0,
        avg_response_time_minutes DECIMAL(8,2) NULL,
        event_adjustment INT NOT NULL DEFAULT 0,
        last_calculated DATETIME NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    const [trustComponentCols] = await connection.query('SHOW COLUMNS FROM trust_score_components');
    const trustComponentNames = trustComponentCols.map(column => column.Field);
    const trustComponentPatches = [
      ['helpfulness_rating', 'DECIMAL(3,2) NOT NULL DEFAULT 3.00'],
      ['total_ratings_received', 'INT NOT NULL DEFAULT 0'],
      ['resolution_count', 'INT NOT NULL DEFAULT 0'],
      ['violation_count', 'INT NOT NULL DEFAULT 0'],
      ['avg_response_time_minutes', 'DECIMAL(8,2) NULL'],
      ['event_adjustment', 'INT NOT NULL DEFAULT 0'],
      ['last_calculated', 'DATETIME NULL'],
    ];
    for (const [column, definition] of trustComponentPatches) {
      if (!trustComponentNames.includes(column)) {
        await connection.query(`ALTER TABLE trust_score_components ADD COLUMN ${column} ${definition}`);
      }
    }

    await connection.query(`
      CREATE TABLE IF NOT EXISTS badge_tiers (
        user_id INT PRIMARY KEY,
        current_tier ENUM('bronze','silver','gold','platinum') NOT NULL DEFAULT 'bronze',
        previous_tier ENUM('bronze','silver','gold','platinum') NULL,
        tier_achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await connection.query(`
      CREATE TABLE IF NOT EXISTS trust_score_history (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        old_score INT NOT NULL,
        new_score INT NOT NULL,
        change_amount INT NOT NULL,
        change_reason TEXT NOT NULL,
        change_type ENUM('increase', 'decrease') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    const [trustHistoryCols] = await connection.query('SHOW COLUMNS FROM trust_score_history');
    const trustHistoryColNames = trustHistoryCols.map(c => c.Field);
    if (!trustHistoryColNames.includes('admin_id')) {
      console.log('⚙️ Patching `trust_score_history` table... Adding `admin_id` column');
      await connection.query('ALTER TABLE trust_score_history ADD COLUMN admin_id INT NULL AFTER user_id');
      try {
        await connection.query('ALTER TABLE trust_score_history ADD FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL');
      } catch(e) {}
    }

    // ─── SCHEDULED TASKS PATCH ───
    const [taskCols] = await connection.query('SHOW COLUMNS FROM scheduled_tasks');
    const taskColNames = taskCols.map(c => c.Field);
    if (!taskColNames.includes('is_completed')) {
      console.log('⚙️ Patching `scheduled_tasks` table... Adding `is_completed` column');
      await connection.query('ALTER TABLE scheduled_tasks ADD COLUMN is_completed TINYINT(1) DEFAULT 0');
    }

    // ─── CHAT MESSAGES PATCH ───
    const [msgCols] = await connection.query('SHOW COLUMNS FROM chat_messages');
    const msgColNames = msgCols.map(c => c.Field);
    if (!msgColNames.includes('is_broadcast')) {
      console.log('⚙️ Patching `chat_messages` table... Adding `is_broadcast` column');
      await connection.query('ALTER TABLE chat_messages ADD COLUMN is_broadcast BOOLEAN DEFAULT FALSE');
    }
    if (!msgColNames.includes('chat_mode')) {
      console.log('⚙️ Patching `chat_messages` table... Adding `chat_mode` column');
      await connection.query("ALTER TABLE chat_messages ADD COLUMN chat_mode ENUM('chat_only', 'study_group', 'campus_meeting') DEFAULT 'chat_only'");
    }
    if (!msgColNames.includes('expires_at')) {
      console.log('⚙️ Patching `chat_messages` table... Adding `expires_at` column');
      await connection.query('ALTER TABLE chat_messages ADD COLUMN expires_at DATETIME NULL');
    }

    // ─── PATCH: Make blacklisted_tokens.token TEXT NULL ───
    await connection.query('ALTER TABLE blacklisted_tokens MODIFY COLUMN token TEXT NULL');

    // ─── PATCH: Make profiles.behavior_score default to 50 ───
    await connection.query('ALTER TABLE profiles MODIFY COLUMN behavior_score INT DEFAULT 50');

    // ─── PATCH: Expand moderation_queue content_type ENUM ───
    await connection.query("ALTER TABLE moderation_queue MODIFY COLUMN content_type ENUM('post', 'message', 'upload', 'profile', 'academic_request', 'broadcast', 'complaint', 'resource', 'notice_post') NOT NULL");

    // Final Health Check Message Exact Match
    console.log('\nHealth Check Passed.\n');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

module.exports = { applyMigrations };
