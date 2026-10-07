-- PeerBridge Base Schema
-- Regenerated on: 2026-10-06T05:55:10.620Z
-- Notice: This schema is automatically synchronized with runtime migrations. 
-- Do not edit this manually unless you are updating the base schema. Keep this in sync with migrations.

SET FOREIGN_KEY_CHECKS=0;

-- PeerBridge Base Schema
-- Regenerated on: 2026-10-06T05:48:58.283Z
-- Notice: This schema is automatically synchronized with runtime migrations. 
-- Do not edit this manually unless you are updating the base schema. Keep this in sync with migrations.

SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS `academic_requests`;
CREATE TABLE `academic_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `anonymous_id` varchar(50) DEFAULT NULL,
  `subject` varchar(100) NOT NULL,
  `urgency` enum('low','medium','high','critical') DEFAULT 'medium',
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `status` enum('open','matched','in_progress','resolved','closed') DEFAULT 'open',
  `matched_helper_id` int DEFAULT NULL,
  `matched_at` datetime DEFAULT NULL,
  `resolved_at` datetime DEFAULT NULL,
  `closed_at` datetime DEFAULT NULL,
  `appeal_status` enum('none','pending','approved','rejected') DEFAULT 'none',
  `ai_moderation_status` enum('clean','hold','rejected') DEFAULT 'clean',
  `ai_moderation_reason` text,
  `daily_post_count` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `matched_helper_id` (`matched_helper_id`),
  CONSTRAINT `academic_requests_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `academic_requests_ibfk_2` FOREIGN KEY (`matched_helper_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `anonymous_id_history`;
CREATE TABLE `anonymous_id_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `old_anonymous_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `new_anonymous_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `rotated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `anonymous_id_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `anonymous_id_map`;
CREATE TABLE `anonymous_id_map` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `anonymous_id` varchar(50) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `anonymous_id` (`anonymous_id`),
  KEY `idx_anon_user_id` (`user_id`),
  CONSTRAINT `anonymous_id_map_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `audit_logs`;
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int DEFAULT NULL,
  `action` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `details` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `target_type` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `target_id` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `severity` enum('LOW','MEDIUM','HIGH') COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_audit_logs_user_id` (`user_id`),
  KEY `idx_audit_logs_action` (`action`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `badge_tiers`;
CREATE TABLE `badge_tiers` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `current_tier` enum('bronze','silver','gold','platinum') DEFAULT 'bronze',
  `tier_achieved_at` datetime DEFAULT NULL,
  `previous_tier` enum('bronze','silver','gold','platinum') DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `badge_tiers_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `blacklisted_tokens`;
CREATE TABLE `blacklisted_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `token` text,
  `user_id` int DEFAULT NULL,
  `blacklisted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_blacklist_user` (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `blocks`;
CREATE TABLE `blocks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `blocker_id` int NOT NULL,
  `blocked_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_block` (`blocker_id`,`blocked_id`),
  KEY `blocked_id` (`blocked_id`),
  CONSTRAINT `blocks_ibfk_1` FOREIGN KEY (`blocker_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `blocks_ibfk_2` FOREIGN KEY (`blocked_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `broadcasts`;
CREATE TABLE `broadcasts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sender_id` int NOT NULL,
  `department` varchar(100) NOT NULL,
  `message` text NOT NULL,
  `sender_role` varchar(50) DEFAULT 'faculty',
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `sender_id` (`sender_id`),
  KEY `idx_dept` (`department`),
  CONSTRAINT `broadcasts_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `chat_messages`;
CREATE TABLE `chat_messages` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sender_id` int NOT NULL,
  `receiver_id` int NOT NULL,
  `message` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `is_flagged` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `chat_mode` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT 'chat_only',
  `seen_at` datetime DEFAULT NULL,
  `expires_at` datetime DEFAULT NULL,
  `is_deleted` tinyint(1) DEFAULT '0',
  `delivered_at` datetime DEFAULT NULL,
  `is_broadcast` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `idx_chat_sender` (`sender_id`),
  KEY `idx_chat_receiver` (`receiver_id`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `chat_messages_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_messages_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `chat_offer_exclusions`;
CREATE TABLE `chat_offer_exclusions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `academic_request_id` int NOT NULL,
  `helper_user_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_exclusion` (`academic_request_id`,`helper_user_id`),
  KEY `helper_user_id` (`helper_user_id`),
  CONSTRAINT `chat_offer_exclusions_ibfk_1` FOREIGN KEY (`academic_request_id`) REFERENCES `academic_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_offer_exclusions_ibfk_2` FOREIGN KEY (`helper_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `chat_requests`;
CREATE TABLE `chat_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `sender_id` int NOT NULL,
  `receiver_id` int NOT NULL,
  `status` enum('pending','accepted','declined','expired','cancelled') DEFAULT 'pending',
  `expires_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `subject_context` varchar(255) DEFAULT NULL,
  `academic_request_id` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `sender_id` (`sender_id`),
  KEY `receiver_id` (`receiver_id`),
  CONSTRAINT `chat_requests_ibfk_1` FOREIGN KEY (`sender_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `chat_requests_ibfk_2` FOREIGN KEY (`receiver_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `chat_rooms`;
CREATE TABLE `chat_rooms` (
  `id` int NOT NULL AUTO_INCREMENT,
  `room_name` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `mode` enum('chat_only','study_group','campus_meeting') COLLATE utf8mb4_unicode_ci DEFAULT 'chat_only',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `room_name` (`room_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `complaint_history`;
CREATE TABLE `complaint_history` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `complaint_id` int NOT NULL,
  `actor_id` int DEFAULT NULL,
  `action` varchar(64) NOT NULL,
  `details` json NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `actor_id` (`actor_id`),
  KEY `idx_complaint_history_case` (`complaint_id`,`created_at`),
  CONSTRAINT `complaint_history_ibfk_1` FOREIGN KEY (`actor_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `conversations`;
CREATE TABLE `conversations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `participant_one` int NOT NULL,
  `participant_two` int NOT NULL,
  `chat_mode` enum('CHAT_ONLY','STUDY_GROUP','CAMPUS_MEETING') DEFAULT 'CHAT_ONLY',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `participant_one` (`participant_one`),
  KEY `participant_two` (`participant_two`),
  CONSTRAINT `conversations_ibfk_1` FOREIGN KEY (`participant_one`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `conversations_ibfk_2` FOREIGN KEY (`participant_two`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `daily_post_tracker`;
CREATE TABLE `daily_post_tracker` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `post_date` date NOT NULL,
  `post_count` int DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_date` (`user_id`,`post_date`),
  CONSTRAINT `daily_post_tracker_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `escalation_records`;
CREATE TABLE `escalation_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `anonymous_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `level` enum('warning','removal','suspension','identity_reveal') COLLATE utf8mb4_unicode_ci NOT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `content_ref` text COLLATE utf8mb4_unicode_ci,
  `actioned_by` int DEFAULT NULL,
  `secondary_approval_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `escalation_records_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `feedback`;
CREATE TABLE `feedback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `from_user` int NOT NULL,
  `to_user` int NOT NULL,
  `rating` int DEFAULT NULL,
  `comment` text,
  `request_id` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `from_user` (`from_user`,`request_id`),
  KEY `to_user` (`to_user`),
  KEY `request_id` (`request_id`),
  CONSTRAINT `feedback_ibfk_1` FOREIGN KEY (`from_user`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `feedback_ibfk_2` FOREIGN KEY (`to_user`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `feedback_ibfk_3` FOREIGN KEY (`request_id`) REFERENCES `chat_requests` (`id`) ON DELETE SET NULL,
  CONSTRAINT `feedback_chk_1` CHECK ((`rating` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `helper_feedback`;
CREATE TABLE `helper_feedback` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `helper_user_id` int NOT NULL,
  `requester_user_id` int NOT NULL,
  `rating` tinyint NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_feedback_per_request` (`request_id`,`helper_user_id`),
  KEY `helper_user_id` (`helper_user_id`),
  KEY `requester_user_id` (`requester_user_id`),
  CONSTRAINT `helper_feedback_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `academic_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `helper_feedback_ibfk_2` FOREIGN KEY (`helper_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `helper_feedback_ibfk_3` FOREIGN KEY (`requester_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `helper_feedback_chk_1` CHECK ((`rating` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `helper_listings`;
CREATE TABLE `helper_listings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `anonymous_id` varchar(50) DEFAULT NULL,
  `subjects` json NOT NULL,
  `availability` enum('available','busy','offline') DEFAULT 'available',
  `max_concurrent_help` int DEFAULT '3',
  `current_help_count` int DEFAULT '0',
  `total_helped` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `helper_listings_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `login_attempts`;
CREATE TABLE `login_attempts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) DEFAULT NULL,
  `ip_address` varchar(50) DEFAULT NULL,
  `attempted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `success` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `migrations`;
CREATE TABLE `migrations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `filename` varchar(255) NOT NULL,
  `executed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `filename` (`filename`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `moderation_queue`;
CREATE TABLE `moderation_queue` (
  `id` int NOT NULL AUTO_INCREMENT,
  `content_type` enum('post','message','upload','profile','academic_request','broadcast','complaint','resource','notice_post') COLLATE utf8mb4_unicode_ci NOT NULL,
  `content_id` int DEFAULT NULL,
  `content_text` text COLLATE utf8mb4_unicode_ci,
  `user_id` int NOT NULL,
  `anonymous_id` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ai_severity` enum('LOW','MEDIUM','HIGH') COLLATE utf8mb4_unicode_ci DEFAULT 'MEDIUM',
  `ai_reason` text COLLATE utf8mb4_unicode_ci,
  `status` enum('pending','approved','rejected','escalated') COLLATE utf8mb4_unicode_ci DEFAULT 'pending',
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `moderation_queue_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `moderation_rules`;
CREATE TABLE `moderation_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `term` varchar(120) NOT NULL,
  `severity` enum('MEDIUM','HIGH') NOT NULL DEFAULT 'MEDIUM',
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `created_by` int DEFAULT NULL,
  `updated_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_moderation_rule_term` (`term`),
  KEY `created_by` (`created_by`),
  KEY `updated_by` (`updated_by`),
  CONSTRAINT `moderation_rules_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  CONSTRAINT `moderation_rules_ibfk_2` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `monthly_leaderboard`;
CREATE TABLE `monthly_leaderboard` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `anonymous_id` varchar(50) DEFAULT NULL,
  `department` varchar(100) DEFAULT NULL,
  `month_year` varchar(7) NOT NULL,
  `help_count` int DEFAULT '0',
  `avg_rating` decimal(3,2) DEFAULT '0.00',
  `trust_score` int DEFAULT '0',
  `rank_position` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_user_month` (`user_id`,`month_year`),
  CONSTRAINT `monthly_leaderboard_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `mood_entries`;
CREATE TABLE `mood_entries` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `anonymous_id` varchar(50) DEFAULT NULL,
  `mood_score` int NOT NULL,
  `notes` text,
  `distress_flag` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `consecutive_low_count` int DEFAULT '0',
  `counselor_alerted` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `mood_entries_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `mood_entries_chk_1` CHECK ((`mood_score` between 1 and 5))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `notice_appeals`;
CREATE TABLE `notice_appeals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `post_id` int NOT NULL,
  `user_id` int NOT NULL,
  `reason` varchar(1000) NOT NULL,
  `status` enum('pending','reviewed') NOT NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_notice_appeal` (`post_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `notice_appeals_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `notice_posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notice_appeals_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `notice_post_reports`;
CREATE TABLE `notice_post_reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `post_id` int NOT NULL,
  `reporter_id` int NOT NULL,
  `reason` varchar(500) NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_notice_reporter` (`post_id`,`reporter_id`),
  KEY `reporter_id` (`reporter_id`),
  CONSTRAINT `notice_post_reports_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `notice_posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notice_post_reports_ibfk_2` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `notice_posts`;
CREATE TABLE `notice_posts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `department` varchar(100) DEFAULT NULL,
  `category` enum('study_groups','lost_found','events','announcements') NOT NULL,
  `title` varchar(120) NOT NULL,
  `body` text NOT NULL,
  `location_name` varchar(100) DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `is_official` tinyint(1) NOT NULL DEFAULT '0',
  `status` enum('published','held','rejected','expired') NOT NULL,
  `is_flagged` tinyint(1) NOT NULL DEFAULT '0',
  `severity` enum('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'LOW',
  `reports_count` int NOT NULL DEFAULT '0',
  `views_count` int NOT NULL DEFAULT '0',
  `trending_score` decimal(10,2) NOT NULL DEFAULT '0.00',
  `appeal_available` tinyint(1) NOT NULL DEFAULT '0',
  `extension_count` tinyint(1) NOT NULL DEFAULT '0',
  `expires_at` datetime NOT NULL,
  `expiry_notified_at` datetime DEFAULT NULL,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `review_note` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `idx_notice_feed` (`status`,`department`,`category`,`created_at`),
  KEY `idx_notice_expiry` (`status`,`expires_at`),
  CONSTRAINT `notice_posts_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notice_posts_ibfk_2` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `notice_reactions`;
CREATE TABLE `notice_reactions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `post_id` int NOT NULL,
  `user_id` int NOT NULL,
  `reaction` enum('like','interested') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_notice_reaction` (`post_id`,`user_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `notice_reactions_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `notice_posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notice_reactions_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `notice_saves`;
CREATE TABLE `notice_saves` (
  `post_id` int NOT NULL,
  `user_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`post_id`,`user_id`),
  KEY `idx_notice_saves_user` (`user_id`,`created_at`),
  CONSTRAINT `notice_saves_ibfk_1` FOREIGN KEY (`post_id`) REFERENCES `notice_posts` (`id`) ON DELETE CASCADE,
  CONSTRAINT `notice_saves_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `notifications`;
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `type` varchar(100) DEFAULT NULL,
  `message` text,
  `is_read` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `password_reset_otps`;
CREATE TABLE `password_reset_otps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `otp_hash` varchar(255) NOT NULL,
  `expires_at` datetime NOT NULL,
  `used_at` datetime DEFAULT NULL,
  `attempts` int DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `peer_matches`;
CREATE TABLE `peer_matches` (
  `id` int NOT NULL AUTO_INCREMENT,
  `requester_id` int NOT NULL,
  `matched_user_id` int NOT NULL,
  `subject` varchar(100) DEFAULT NULL,
  `match_score` decimal(5,2) DEFAULT NULL,
  `status` enum('PENDING','ACCEPTED','DECLINED','EXPIRED') DEFAULT 'PENDING',
  `response_deadline` datetime DEFAULT NULL,
  `feedback_rating` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `requester_id` (`requester_id`),
  KEY `matched_user_id` (`matched_user_id`),
  CONSTRAINT `peer_matches_ibfk_1` FOREIGN KEY (`requester_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `peer_matches_ibfk_2` FOREIGN KEY (`matched_user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `policy_reviews`;
CREATE TABLE `policy_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `review_week` date NOT NULL,
  `reviewer_id` int DEFAULT NULL,
  `summary` text NOT NULL,
  `completed_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_policy_review_week` (`review_week`),
  KEY `reviewer_id` (`reviewer_id`),
  CONSTRAINT `policy_reviews_ibfk_1` FOREIGN KEY (`reviewer_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `profiles`;
CREATE TABLE `profiles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `anonymous_id` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `designation` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `subjects` json DEFAULT NULL,
  `office_hours` json DEFAULT NULL,
  `skills` json DEFAULT NULL,
  `behavior_score` int DEFAULT '50',
  `consent_mood_tracking` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deletion_scheduled_at` datetime DEFAULT NULL,
  `semester` int DEFAULT NULL,
  `name` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `consent_mood_data` tinyint(1) DEFAULT '0',
  `consent_analytics` tinyint(1) DEFAULT '0',
  `onboarding_complete` tinyint(1) DEFAULT '0',
  `last_active` datetime DEFAULT NULL,
  `trust_score` int DEFAULT '50',
  `is_first_login` tinyint(1) DEFAULT '1',
  `profile_photo_url` varchar(500) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `consent_data_collection` tinyint(1) DEFAULT '0',
  `consent_ai_analysis` tinyint(1) DEFAULT '0',
  `bio` text COLLATE utf8mb4_unicode_ci,
  PRIMARY KEY (`id`),
  UNIQUE KEY `anonymous_id` (`anonymous_id`),
  KEY `idx_profiles_anonymous_id` (`anonymous_id`),
  KEY `idx_profiles_user_id` (`user_id`),
  CONSTRAINT `profiles_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `refresh_tokens`;
CREATE TABLE `refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `token` text NOT NULL,
  `expires_at` datetime NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `refresh_tokens_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `reports`;
CREATE TABLE `reports` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reporter_id` int NOT NULL,
  `reported_id` int DEFAULT NULL,
  `reason` text COLLATE utf8mb4_unicode_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `evidence_ref` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `category` enum('harassment','abusive_language','academic_dispute','privacy_violation','spam_scam','spam_or_scam','other') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'other',
  `status` enum('open','under_review','escalated','resolved','rejected','dismissed') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'open',
  `level` tinyint NOT NULL DEFAULT '1',
  `priority` enum('normal','high') COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'normal',
  `is_flagged` tinyint(1) NOT NULL DEFAULT '0',
  `assigned_to` int DEFAULT NULL,
  `faculty_note` text COLLATE utf8mb4_unicode_ci,
  `resolved_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `reporter_id` (`reporter_id`),
  KEY `reported_id` (`reported_id`),
  KEY `idx_reports_assigned_level` (`assigned_to`,`level`,`status`),
  CONSTRAINT `reports_ibfk_1` FOREIGN KEY (`reporter_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `reports_ibfk_2` FOREIGN KEY (`reported_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `request_appeals`;
CREATE TABLE `request_appeals` (
  `id` int NOT NULL AUTO_INCREMENT,
  `request_id` int NOT NULL,
  `user_id` int NOT NULL,
  `appeal_reason` text NOT NULL,
  `status` enum('pending','approved','rejected') DEFAULT 'pending',
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `request_id` (`request_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `request_appeals_ibfk_1` FOREIGN KEY (`request_id`) REFERENCES `academic_requests` (`id`) ON DELETE CASCADE,
  CONSTRAINT `request_appeals_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `resource_bookmarks`;
CREATE TABLE `resource_bookmarks` (
  `resource_id` int NOT NULL,
  `user_id` int NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`resource_id`,`user_id`),
  KEY `idx_resource_bookmarks_user` (`user_id`,`created_at`),
  CONSTRAINT `resource_bookmarks_ibfk_1` FOREIGN KEY (`resource_id`) REFERENCES `resources` (`id`) ON DELETE CASCADE,
  CONSTRAINT `resource_bookmarks_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `resource_reviews`;
CREATE TABLE `resource_reviews` (
  `id` int NOT NULL AUTO_INCREMENT,
  `resource_id` int NOT NULL,
  `user_id` int NOT NULL,
  `rating` tinyint NOT NULL,
  `review` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_resource_review` (`resource_id`,`user_id`),
  KEY `user_id` (`user_id`),
  KEY `idx_resource_reviews_resource` (`resource_id`,`rating`),
  CONSTRAINT `resource_reviews_ibfk_1` FOREIGN KEY (`resource_id`) REFERENCES `resources` (`id`) ON DELETE CASCADE,
  CONSTRAINT `resource_reviews_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `resources`;
CREATE TABLE `resources` (
  `id` int NOT NULL AUTO_INCREMENT,
  `uploader_id` int NOT NULL,
  `title` varchar(160) NOT NULL,
  `description` text NOT NULL,
  `subject` varchar(100) DEFAULT NULL,
  `semester` varchar(30) DEFAULT NULL,
  `category` varchar(50) NOT NULL,
  `external_url` varchar(2048) DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `original_file_name` varchar(255) DEFAULT NULL,
  `mime_type` varchar(120) DEFAULT NULL,
  `file_size` bigint DEFAULT NULL,
  `status` enum('pending','approved','rejected','flagged') NOT NULL DEFAULT 'pending',
  `is_flagged` tinyint(1) NOT NULL DEFAULT '0',
  `moderation_reason` text,
  `reviewed_by` int DEFAULT NULL,
  `reviewed_at` datetime DEFAULT NULL,
  `review_note` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `uploader_id` (`uploader_id`),
  KEY `reviewed_by` (`reviewed_by`),
  KEY `idx_resources_status` (`status`,`created_at`),
  KEY `idx_resources_filters` (`subject`,`semester`,`category`),
  CONSTRAINT `resources_ibfk_1` FOREIGN KEY (`uploader_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `resources_ibfk_2` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `scheduled_tasks`;
CREATE TABLE `scheduled_tasks` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `task_type` varchar(100) DEFAULT NULL,
  `execute_at` datetime NOT NULL,
  `payload` json DEFAULT NULL,
  `is_executed` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `is_completed` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `scheduled_tasks_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `trust_score_components`;
CREATE TABLE `trust_score_components` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `helpfulness_rating` decimal(3,2) DEFAULT '0.00',
  `resolution_count` int DEFAULT '0',
  `violation_count` int DEFAULT '0',
  `avg_response_time_minutes` int DEFAULT '0',
  `total_ratings_received` int DEFAULT '0',
  `last_calculated` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `event_adjustment` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `trust_score_components_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `trust_score_history`;
CREATE TABLE `trust_score_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `admin_id` int DEFAULT NULL,
  `old_score` int NOT NULL,
  `new_score` int NOT NULL,
  `change_amount` int NOT NULL,
  `change_reason` varchar(255) NOT NULL,
  `change_type` enum('increase','decrease') NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `admin_id` (`admin_id`),
  CONSTRAINT `trust_score_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `trust_score_history_ibfk_2` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `trust_scores`;
CREATE TABLE `trust_scores` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `score` int DEFAULT '50',
  `helpfulness_rating` decimal(3,2) DEFAULT '0.00',
  `resolution_count` int DEFAULT '0',
  `violation_count` int DEFAULT '0',
  `avg_response_time` int DEFAULT '0',
  `badge_tier` enum('BRONZE','SILVER','GOLD','PLATINUM') DEFAULT 'BRONZE',
  `last_calculated` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `trust_scores_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password_hash` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `role` enum('student','faculty','counselor_admin','dept_admin','admin','super_admin') COLLATE utf8mb4_unicode_ci DEFAULT 'student',
  `failed_attempts` int DEFAULT '0',
  `is_locked` tinyint(1) DEFAULT '0',
  `lock_until` datetime DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `is_first_login` tinyint(1) DEFAULT '1',
  `deletion_scheduled_at` datetime DEFAULT NULL,
  `behavior_score` int DEFAULT '0',
  `is_deleted` tinyint(1) DEFAULT '0',
  `deleted_at` datetime DEFAULT NULL,
  `otp_code` varchar(10) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `otp_expires_at` datetime DEFAULT NULL,
  `otp_failed_attempts` int DEFAULT '0',
  `deletion_warning_sent_at` datetime DEFAULT NULL,
  `last_login` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_users_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `violation_history`;
CREATE TABLE `violation_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `violation_type` varchar(100) DEFAULT NULL,
  `severity` enum('LOW','MEDIUM','HIGH') DEFAULT NULL,
  `action_taken` enum('WARNING','REMOVAL','SUSPENSION','IDENTITY_REVEAL') DEFAULT NULL,
  `reviewed_by` int DEFAULT NULL,
  `justification` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `violation_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

SET FOREIGN_KEY_CHECKS=1;

SET FOREIGN_KEY_CHECKS=1;
