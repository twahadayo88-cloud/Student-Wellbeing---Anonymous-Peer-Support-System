const bcrypt = require('bcryptjs');
const { query } = require('../src/config/db.config');

async function run() {
  try {
    const passwordHash = await bcrypt.hash('Password123', 12);
    console.log("HASH:", passwordHash);
    
    // Inline the values directly to avoid malformed prepared statement issues
    await query(`UPDATE users SET password_hash = "${passwordHash}", failed_attempts = 0, is_locked = 0, lock_until = NULL WHERE email = 'professor.asad@faculty.iiui.edu'`);
    console.log("Updated password for professor.asad@faculty.iiui.edu");
    
    const [user] = await query("SELECT id FROM users WHERE email = 'professor.asad@faculty.iiui.edu'");
    if (user.length > 0) {
      const userId = user[0].id;
      await query(`UPDATE profiles SET department = 'Computer Science' WHERE user_id = ${userId}`);
      console.log("Ensured profile department is 'Computer Science'");
      
      const [profile] = await query(`SELECT * FROM profiles WHERE user_id = ${userId}`);
      console.log("Profile of professor.asad:", JSON.stringify(profile, null, 2));
    }
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
