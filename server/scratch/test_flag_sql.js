const { query, pool } = require('../src/config/db.config');
(async () => {
  try {
    await query(`UPDATE resources r
     SET status = 'flagged', is_flagged = 1,
         moderation_reason = 'Low average rating; returned to faculty review queue'
     WHERE r.id = 1
       AND (SELECT COUNT(*) FROM resource_reviews rr WHERE rr.resource_id = r.id) >= 3
       AND (SELECT AVG(rr.rating) FROM resource_reviews rr WHERE rr.resource_id = r.id) < 2.5`);
    console.log('OK');
  } catch (e) {
    console.error('ERR:', e.code, e.message);
    console.error('SQLSTATE:', e.sqlState);
  }
  await pool.end();
})();
