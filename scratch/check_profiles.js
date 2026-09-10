const { query } = require('./server/src/config/db.config');
const logger = require('./server/src/config/db.config');

async function check() {
  try {
    const [rows] = await query('DESCRIBE profiles');
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
