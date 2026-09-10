const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });
  try {
    const [cols] = await connection.query('SHOW COLUMNS FROM profiles');
    console.log('\n--- PROFILES COLUMNS ---');
    cols.forEach(c => console.log(`${c.Field}: ${c.Type} | Null: ${c.Null} | Default: ${c.Default}`));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

run();
