const { query, pool } = require('../src/config/db.config');
(async () => {
  const [reviews] = await query('SELECT resource_id, rating, review FROM resource_reviews WHERE resource_id = 1');
  console.log('reviews:', JSON.stringify(reviews));
  const [agg] = await query('SELECT COUNT(*) c, AVG(rating) a FROM resource_reviews WHERE resource_id = 1');
  console.log('agg:', JSON.stringify(agg));
  const [res] = await query('SELECT id, status, is_flagged FROM resources WHERE id = 1');
  console.log('resource:', JSON.stringify(res));
  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
