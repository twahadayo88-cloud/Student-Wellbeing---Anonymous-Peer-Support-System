const mysql = require('mysql2/promise');
require('../src/config/env.config');

async function showIndexes() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  const tables = ['profiles', 'badge_tiers', 'trust_score_components', 'monthly_leaderboard', 'trust_score_history'];

  for (const table of tables) {
    try {
      const [rows] = await connection.query(`SHOW INDEX FROM ${table}`);
      console.log(`\nTable: ${table} Indexes:`);
      console.table(rows.map(r => ({ Table: r.Table, Non_unique: r.Non_unique, Key_name: r.Key_name, Seq_in_index: r.Seq_in_index, Column_name: r.Column_name })));
    } catch (e) {
      console.error(`⚠️ Table ${table} index check failed: ${e.message}`);
    }
  }

  await connection.end();
}

showIndexes().catch(console.error);
