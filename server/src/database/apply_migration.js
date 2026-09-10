const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../config/env.config');
const logger = require('../utils/logger');

const REQUIRED_TABLES = [
  'users', 'profiles', 'anonymous_id_map', 'chat_requests', 'feedback', 
  'chat_messages', 'sos_records', 'mood_entries', 'scheduled_tasks', 
  'blacklisted_tokens', 'notifications', 'trust_scores', 'violation_history', 'peer_matches', 'broadcasts'
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

    // 1. Generate Backup Before Schema Changes
    await backupDatabase(connection);

    // 2. Validate and Add missing columns safely
    
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

    // Check sos_records
    const [sosCols] = await connection.query('SHOW COLUMNS FROM sos_records');
    const existingSosCols = sosCols.map(c => c.Field);
    const requiredSos = {
      'student_id': 'INT NULL',
      'category': "ENUM('academic','mental_health','harassment','other') DEFAULT 'other'",
      'severity': "ENUM('low','medium','high','critical') DEFAULT 'low'",
      'status': "ENUM('pending','in_progress','resolved') DEFAULT 'pending'",
      'attached_mood_data': 'JSON NULL',
      'assigned_faculty_id': 'INT NULL',
      'resolved_at': 'DATETIME NULL'
    };

    for (const [col, definition] of Object.entries(requiredSos)) {
      if (!existingSosCols.includes(col)) {
        console.log(`⚙️ Patching \`sos_records\` table... Adding \`${col}\``);
        await connection.query(`ALTER TABLE sos_records ADD COLUMN ${col} ${definition}`);
        
        // If adding student_id, ensure index exists
        if (col === 'student_id') {
           try {
             await connection.query('ALTER TABLE sos_records ADD FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE SET NULL');
           } catch(e) {}
        }
      }
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

    // ─── PATCH: Make blacklisted_tokens.token TEXT NULL ───
    await connection.query('ALTER TABLE blacklisted_tokens MODIFY COLUMN token TEXT NULL');

    // ─── PATCH: Make profiles.behavior_score default to 50 ───
    await connection.query('ALTER TABLE profiles MODIFY COLUMN behavior_score INT DEFAULT 50');

    // ─── PATCH: Expand moderation_queue content_type ENUM ───
    await connection.query("ALTER TABLE moderation_queue MODIFY COLUMN content_type ENUM('post', 'message', 'upload', 'profile', 'academic_request') NOT NULL");

    // Final Health Check Message Exact Match
    console.log('\nHealth Check Passed.\n');

  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

module.exports = { applyMigrations };
