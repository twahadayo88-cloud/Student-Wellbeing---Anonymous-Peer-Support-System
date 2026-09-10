const { query } = require('../src/config/db.config');

async function check() {
  try {
    const [cols] = await query('SHOW COLUMNS FROM blacklisted_tokens');
    console.log(JSON.stringify(cols, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

check();
