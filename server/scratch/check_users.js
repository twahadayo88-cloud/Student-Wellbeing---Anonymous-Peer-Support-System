const { query } = require('../src/config/db.config');

async function check() {
  try {
    const [facultyUsers] = await query("SELECT * FROM users WHERE role = 'faculty'");
    console.log("FACULTY USERS:");
    console.log(JSON.stringify(facultyUsers, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
