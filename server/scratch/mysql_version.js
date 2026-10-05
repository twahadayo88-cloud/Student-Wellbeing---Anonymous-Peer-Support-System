const { query, pool } = require('../src/config/db.config');
(async () => {
  const [r] = await query("SELECT VERSION() as v");
  console.log('MySQL version:', r[0].v);
  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
