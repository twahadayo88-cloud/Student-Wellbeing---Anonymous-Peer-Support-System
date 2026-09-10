const { query } = require('../src/config/db.config');

async function cleanup() {
  try {
    console.log('--- Database Chat Request Cleanup ---');
    
    // 1. Identify pairs with duplicates
    const [duplicates] = await query(`
      SELECT 
        LEAST(sender_id, receiver_id) as u1, 
        GREATEST(sender_id, receiver_id) as u2, 
        COUNT(*) as cnt, 
        MAX(id) as max_id 
      FROM chat_requests 
      WHERE status = 'accepted' 
      GROUP BY u1, u2 
      HAVING cnt > 1
    `);

    if (duplicates.length === 0) {
      console.log('No duplicate accepted chat requests found.');
      return;
    }

    console.log(`Found ${duplicates.length} pairs with duplicate accepted requests.`);

    for (const dup of duplicates) {
      console.log(`Cleaning pair (${dup.u1}, ${dup.u2}). Keeping latest ID: ${dup.max_id}`);
      
      // Delete older accepted requests for this pair
      const [result] = await query(`
        DELETE FROM chat_requests 
        WHERE status = 'accepted'
        AND LEAST(sender_id, receiver_id) = ? 
        AND GREATEST(sender_id, receiver_id) = ?
        AND id < ?
      `, [dup.u1, dup.u2, dup.max_id]);
      
      console.log(`Deleted ${result.affectedRows} older records.`);
    }

    console.log('--- Cleanup Finished ---');
  } catch (err) {
    console.error('Cleanup failed:', err);
  } finally {
    process.exit();
  }
}

cleanup();
