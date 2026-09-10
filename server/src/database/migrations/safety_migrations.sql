
-- 1. Create escalation_records table
CREATE TABLE IF NOT EXISTS escalation_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  anonymous_id VARCHAR(50),
  level ENUM('warning', 'removal', 'suspension', 'identity_reveal') NOT NULL,
  reason TEXT,
  content_ref TEXT,
  actioned_by INT,
  secondary_approval_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create moderation_queue table
CREATE TABLE IF NOT EXISTS moderation_queue (
  id INT AUTO_INCREMENT PRIMARY KEY,
  content_type ENUM('post', 'message', 'upload', 'profile') NOT NULL,
  content_id INT,
  content_text TEXT,
  user_id INT NOT NULL,
  anonymous_id VARCHAR(50),
  ai_severity ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'MEDIUM',
  ai_reason TEXT,
  status ENUM('pending', 'approved', 'rejected', 'escalated') DEFAULT 'pending',
  reviewed_by INT NULL,
  reviewed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. Create anonymous_id_history table
CREATE TABLE IF NOT EXISTS anonymous_id_history (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  old_anonymous_id VARCHAR(50),
  new_anonymous_id VARCHAR(50),
  rotated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. Update profiles table to include behavior_score
-- Try simple ALTER, will fail if exists but that's okay for this one-off
ALTER TABLE profiles ADD COLUMN behavior_score INT DEFAULT 50;

-- 5. Update audit_logs table to include target_type, target_id, severity
ALTER TABLE audit_logs ADD COLUMN target_type VARCHAR(50);
ALTER TABLE audit_logs ADD COLUMN target_id VARCHAR(255);
ALTER TABLE audit_logs ADD COLUMN severity ENUM('LOW', 'MEDIUM', 'HIGH');
