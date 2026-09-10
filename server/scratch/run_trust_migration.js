const { pool } = require('../src/config/db.config');

async function runMigration() {
  const sql = `
    CREATE TABLE IF NOT EXISTS trust_score_history (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      old_score INT NOT NULL,
      new_score INT NOT NULL,
      change_amount INT NOT NULL,
      change_reason VARCHAR(255) NOT NULL,
      change_type ENUM('increase', 'decrease') NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS trust_score_components (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      helpfulness_rating DECIMAL(3,2) DEFAULT 0.00,
      resolution_count INT DEFAULT 0,
      violation_count INT DEFAULT 0,
      avg_response_time_minutes INT DEFAULT 0,
      total_ratings_received INT DEFAULT 0,
      last_calculated DATETIME NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS badge_tiers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL UNIQUE,
      current_tier ENUM('bronze', 'silver', 'gold', 'platinum') DEFAULT 'bronze',
      tier_achieved_at DATETIME NULL,
      previous_tier ENUM('bronze', 'silver', 'gold', 'platinum') NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS monthly_leaderboard (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      anonymous_id VARCHAR(50),
      department VARCHAR(100),
      month_year VARCHAR(7) NOT NULL,
      help_count INT DEFAULT 0,
      avg_rating DECIMAL(3,2) DEFAULT 0.00,
      trust_score INT DEFAULT 0,
      rank_position INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY unique_user_month (user_id, month_year),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `;

  try {
    const statements = sql.split(';').filter(s => s.trim() !== '');
    for (const statement of statements) {
      await pool.query(statement);
    }
    console.log('✅ Trust Score migrations applied successfully');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
  process.exit(0);
}

runMigration();
