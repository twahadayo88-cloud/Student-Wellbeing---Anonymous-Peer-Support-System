-- ═══════════════════════════════════════════════════════════════
-- PeerBridge — Canonical Database Schema
-- ═══════════════════════════════════════════════════════════════
-- This is the definitive schema. Run on a fresh database.
-- For existing databases, use migration_profile_upgrade.sql.
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('student', 'faculty', 'admin', 'super_admin') NOT NULL,
    is_first_login BOOLEAN DEFAULT TRUE,
    failed_attempts INT DEFAULT 0,
    is_locked BOOLEAN DEFAULT FALSE,
    lock_until DATETIME NULL,
    deletion_scheduled_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_users_email (email),
    INDEX idx_users_deletion (deletion_scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS profiles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    anonymous_id VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) DEFAULT NULL,
    department VARCHAR(100) DEFAULT NULL,
    designation VARCHAR(100) DEFAULT NULL,
    semester INT DEFAULT NULL,
    skills JSON DEFAULT NULL,
    subjects JSON DEFAULT NULL,
    office_hours VARCHAR(255) DEFAULT NULL,
    behavior_score INT DEFAULT 0,
    trust_score INT DEFAULT 50,
    bio TEXT DEFAULT NULL,
    profile_photo_url VARCHAR(500) DEFAULT NULL,
    onboarding_complete BOOLEAN DEFAULT FALSE,
    is_first_login BOOLEAN DEFAULT TRUE,
    consent_data_collection BOOLEAN DEFAULT FALSE,
    consent_mood_tracking BOOLEAN DEFAULT FALSE,
    consent_ai_analysis BOOLEAN DEFAULT FALSE,
    deletion_scheduled_at DATETIME DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_profiles_anonymous_id (anonymous_id),
    INDEX idx_profiles_user_id (user_id),
    INDEX idx_profiles_deletion (deletion_scheduled_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    action VARCHAR(255) NOT NULL,
    details JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_audit_logs_user_id (user_id),
    INDEX idx_audit_logs_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
