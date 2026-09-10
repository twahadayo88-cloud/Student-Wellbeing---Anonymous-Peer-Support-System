const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });
const bcrypt = require('bcryptjs');
const { pool } = require('../../config/db.config');
const { ROLES } = require('../../utils/constants');

/**
 * Super Admin Seeder
 * ==================
 * Creates a master super_admin account for system initialization.
 * Run this ONCE during initial server setup.
 */
async function seedSuperAdmin() {
  console.log('--- PeerBridge Super Admin Seeder ---');
  
  const email = 'super_admin@peerbridge.edu.pk';
  const password = 'Admin@Password123'; // Strong password as per new policy
  
  try {
    // 1. Check if super_admin already exists
    const [existing] = await pool.execute('SELECT id FROM users WHERE role = ?', [ROLES.SUPER_ADMIN]);
    
    if (existing.length > 0) {
      console.log('⚠️ Super Admin already exists. Skipping seed.');
      process.exit(0);
    }

    const passwordHash = await bcrypt.hash(password, 12);
    
    // 2. Create User
    const [userResult] = await pool.execute(
      'INSERT INTO users (email, password_hash, role) VALUES (?, ?, ?)',
      [email, passwordHash, ROLES.SUPER_ADMIN]
    );
    
    const userId = userResult.insertId;
    const anonymousId = 'ROOT_ADMIN_01';

    // 3. Create Profile Mapping
    await pool.execute(
      'INSERT INTO profiles (user_id, anonymous_id, department) VALUES (?, ?, ?)',
      [userId, anonymousId, 'IT Security']
    );

    await pool.execute(
      'INSERT INTO anonymous_id_map (user_id, anonymous_id) VALUES (?, ?)',
      [userId, anonymousId]
    );

    console.log('✅ Super Admin Seeded Successfully!');
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${password}`);
    console.log('   NOTE: Change this password immediately after first login.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

seedSuperAdmin();
