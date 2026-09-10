const { query } = require('./server/src/config/db.config');

async function fixEnum() {
  console.log('🔄 Normalizing chat_requests.status ENUM...');
  try {
    await query("ALTER TABLE chat_requests MODIFY COLUMN status ENUM('pending','accepted','declined','expired','cancelled') DEFAULT 'pending'");
    console.log('✅ Adjusted ENUM to lowercase.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Failed to adjust ENUM:', err.message);
    process.exit(1);
  }
}

fixEnum();
