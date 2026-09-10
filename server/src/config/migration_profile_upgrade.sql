-- ═══════════════════════════════════════════════════════════════
-- PeerBridge — Profile Module Schema Migration
-- ═══════════════════════════════════════════════════════════════
-- Adds missing columns required by the Smart User Profile System.
-- Safe to run multiple times (uses IF NOT EXISTS / IGNORE patterns).
-- ═══════════════════════════════════════════════════════════════

-- ─── Users Table ──────────────────────────────────────────────

-- First login onboarding flag
ALTER TABLE users ADD COLUMN is_first_login BOOLEAN DEFAULT TRUE;

-- GDPR: Soft deletion scheduling
ALTER TABLE users ADD COLUMN deletion_scheduled_at DATETIME DEFAULT NULL;

-- ─── Profiles Table ───────────────────────────────────────────

-- Add missing GDPR & Selective Anonymity columns
ALTER TABLE profiles ADD COLUMN name VARCHAR(255) DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN semester INT DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN subjects JSON DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN office_hours VARCHAR(255) DEFAULT NULL;
ALTER TABLE profiles ADD COLUMN deletion_scheduled_at DATETIME DEFAULT NULL;

-- ─── Indexes ──────────────────────────────────────────────────

-- Fast deletion queue lookups (for CRON/worker)
CREATE INDEX idx_users_deletion ON users(deletion_scheduled_at);
CREATE INDEX idx_profiles_deletion ON profiles(deletion_scheduled_at);
