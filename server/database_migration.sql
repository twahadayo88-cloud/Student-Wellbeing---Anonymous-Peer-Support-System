-- PeerBridge Consolidated Database Schema
-- Last Updated: April 9, 2026
-- This file is automatically executed on server startup.

-- 1. Anonymous Identity Mapping
CREATE TABLE IF NOT EXISTS anonymous_id_map (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  anonymous_id VARCHAR(50) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 3. Profile Table Extensions (Smart Matching & Privacy)
-- Added Trust Score, Matching Context, and full consent/privacy fields
ALTER TABLE users ADD COLUMN behavior_score INT DEFAULT 50;
ALTER TABLE users ADD COLUMN deletion_scheduled_at DATETIME NULL;
ALTER TABLE users ADD COLUMN deletion_warning_sent_at DATETIME NULL;
ALTER TABLE users ADD COLUMN otp_code VARCHAR(6) NULL;
ALTER TABLE users ADD COLUMN otp_expires_at DATETIME NULL;
ALTER TABLE users ADD COLUMN otp_failed_attempts INT DEFAULT 0;

-- Profile table enhancements
ALTER TABLE profiles ADD COLUMN bio TEXT NULL;
ALTER TABLE profiles ADD COLUMN profile_photo_url VARCHAR(500) NULL;
ALTER TABLE profiles ADD COLUMN trust_score INT DEFAULT 50;
ALTER TABLE profiles ADD COLUMN onboarding_complete BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN consent_data_collection BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN consent_mood_tracking BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN consent_ai_analysis BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN semester VARCHAR(20) NULL;
ALTER TABLE profiles ADD COLUMN skills JSON NULL;
ALTER TABLE profiles ADD COLUMN subjects JSON NULL;
ALTER TABLE profiles ADD COLUMN office_hours JSON NULL;
ALTER TABLE profiles ADD COLUMN department VARCHAR(100) NULL;
ALTER TABLE profiles ADD COLUMN deletion_scheduled_at DATETIME NULL;

-- 4. Chat Request System (Consent-Based Messaging)
CREATE TABLE IF NOT EXISTS chat_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  receiver_id INT NOT NULL,
  subject_context VARCHAR(255),
  status ENUM('pending','accepted','declined','expired') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- BUG-005 FIX: Removed duplicate ALTER TABLE for subject_context.
-- It is already defined in the CREATE TABLE above (line 39).

-- 5. Unified Feedback & Reputation System
CREATE TABLE IF NOT EXISTS feedback (
  id INT AUTO_INCREMENT PRIMARY KEY,
  from_user INT NOT NULL,
  to_user INT NOT NULL,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NULL,
  request_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_user) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (request_id) REFERENCES chat_requests(id) ON DELETE SET NULL,
  UNIQUE(from_user, request_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 6. Messaging Extensions (AI Moderation & Broadcasts)
ALTER TABLE chat_messages ADD COLUMN is_broadcast BOOLEAN DEFAULT FALSE;
ALTER TABLE chat_messages ADD COLUMN chat_mode ENUM('chat_only', 'study_group', 'campus_meeting') DEFAULT 'chat_only';
ALTER TABLE chat_messages ADD COLUMN expires_at DATETIME NULL;

-- 7. Crisis SOS Records
CREATE TABLE IF NOT EXISTS sos_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  student_id INT NOT NULL,
  category ENUM('self-harm', 'harassment', 'medical', 'other') DEFAULT 'other',
  severity ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'LOW',
  message TEXT NULL,
  status ENUM('active', 'resolved', 'anonymous_support') DEFAULT 'active',
  attached_mood_data JSON NULL,
  assigned_faculty_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME NULL,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (assigned_faculty_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 8. Mood Tracking (Core Wellbeing Hub Dependency)
CREATE TABLE IF NOT EXISTS mood_entries (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  mood_score INT NOT NULL,
  note TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_mood_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 9. Scheduled Background Tasks
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  task_type VARCHAR(50) NOT NULL,
  execute_at DATETIME NOT NULL,
  payload JSON NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_task_execution (execute_at, is_completed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Security: Token Blacklist (Logout)
CREATE TABLE IF NOT EXISTS blacklisted_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NULL,
  token TEXT NOT NULL,
  blacklisted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_token (token(255)),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 11. Persistent Departmental Broadcasts
CREATE TABLE IF NOT EXISTS broadcasts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sender_id INT NOT NULL,
  department VARCHAR(100) NOT NULL,
  message TEXT NOT NULL,
  sender_role VARCHAR(50) DEFAULT 'faculty',
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_dept (department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 12. Academic Support Board System
CREATE TABLE IF NOT EXISTS academic_requests (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  anonymous_id VARCHAR(50),
  subject VARCHAR(100) NOT NULL,
  urgency ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium',
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status ENUM('open', 'matched', 'in_progress', 'resolved', 'closed') DEFAULT 'open',
  matched_helper_id INT NULL,
  matched_at DATETIME NULL,
  resolved_at DATETIME NULL,
  closed_at DATETIME NULL,
  appeal_status ENUM('none', 'pending', 'approved', 'rejected') DEFAULT 'none',
  ai_moderation_status ENUM('clean', 'hold', 'rejected') DEFAULT 'clean',
  ai_moderation_reason TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (matched_helper_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS helper_listings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  anonymous_id VARCHAR(50),
  subjects JSON NOT NULL,
  availability ENUM('available', 'busy', 'offline') DEFAULT 'available',
  max_concurrent_help INT DEFAULT 3,
  current_help_count INT DEFAULT 0,
  total_helped INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS request_appeals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  request_id INT NOT NULL,
  user_id INT NOT NULL,
  appeal_reason TEXT NOT NULL,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (request_id) REFERENCES academic_requests(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS daily_post_tracker (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  post_date DATE NOT NULL,
  post_count INT DEFAULT 0,
  UNIQUE KEY unique_user_date (user_id, post_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Hardening existing tables for safety/wellness
-- Note: columns are also safely added via apply_migration.js
ALTER TABLE scheduled_tasks ADD COLUMN is_completed TINYINT(1) DEFAULT 0;
ALTER TABLE scheduled_tasks ADD COLUMN task_type VARCHAR(50) DEFAULT 'general';
ALTER TABLE scheduled_tasks ADD COLUMN execute_at DATETIME;


-- 13. Reputation & Trust Score History
CREATE TABLE IF NOT EXISTS trust_score_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  admin_id INT NULL,
  old_score INT NOT NULL,
  new_score INT NOT NULL,
  change_amount INT NOT NULL,
  change_reason TEXT NOT NULL,
  change_type ENUM('increase', 'decrease') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 14. Badge Tiers Table
CREATE TABLE IF NOT EXISTS badge_tiers (
  user_id INT PRIMARY KEY,
  current_tier ENUM('bronze', 'silver', 'gold', 'platinum') DEFAULT 'bronze',
  previous_tier ENUM('bronze', 'silver', 'gold', 'platinum') NULL,
  tier_achieved_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 15. Monthly Leaderboard
CREATE TABLE IF NOT EXISTS monthly_leaderboard (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  anonymous_id VARCHAR(50) NOT NULL,
  department VARCHAR(100) NOT NULL,
  month_year VARCHAR(7) NOT NULL, -- YYYY-MM
  help_count INT DEFAULT 0,
  avg_rating DECIMAL(3,2) DEFAULT 0.00,
  trust_score INT DEFAULT 0,
  rank_position INT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_user_month (user_id, month_year),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
