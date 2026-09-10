const mysql = require('mysql2/promise');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

async function run() {
  const connection = await mysql.createConnection(dbConfig);
  try {
    const [profilesCols] = await connection.query('SHOW COLUMNS FROM profiles');
    console.log('\n--- PROFILES COLUMNS ---');
    profilesCols.forEach(c => console.log(`${c.Field}: ${c.Type} | Null: ${c.Null} | Default: ${c.Default}`));

    const [usersCols] = await connection.query('SHOW COLUMNS FROM users');
    console.log('\n--- USERS COLUMNS ---');
    usersCols.forEach(c => console.log(`${c.Field}: ${c.Type} | Null: ${c.Null} | Default: ${c.Default}`));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

run();
