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
    const [tables] = await connection.query('SHOW TABLES');
    console.log('Tables in database:', tables.map(t => Object.values(t)[0]));
  } catch (err) {
    console.error(err);
  } finally {
    await connection.end();
  }
}

run();
