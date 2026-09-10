-- PeerBridge Academic Support Board Migrations
-- ==============================================

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
  daily_post_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (matched_helper_id) REFERENCES users(id) ON DELETE SET NULL
);

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
);

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
);

CREATE TABLE IF NOT EXISTS daily_post_tracker (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  post_date DATE NOT NULL,
  post_count INT DEFAULT 0,
  UNIQUE KEY unique_user_date (user_id, post_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Hardening existing tables for safety/wellness
ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS is_completed TINYINT(1) DEFAULT 0;
ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS task_type VARCHAR(50) DEFAULT 'general';
ALTER TABLE scheduled_tasks ADD COLUMN IF NOT EXISTS execute_at DATETIME;
