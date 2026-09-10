const mysql = require('mysql2/promise');

async function fix() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '1234',
    database: 'peerbridge'
  });
  
  try { 
    await connection.query("ALTER TABLE chat_messages ADD COLUMN chat_mode VARCHAR(50) DEFAULT 'chat_only'"); 
    console.log("Added chat_mode");
  } catch(e) { console.log("chat_mode exists or error:", e.message); }
  
  try { 
    await connection.query("ALTER TABLE chat_messages ADD COLUMN is_flagged BOOLEAN DEFAULT FALSE"); 
    console.log("Added is_flagged");
  } catch(e) { console.log("is_flagged exists or error:", e.message); }
  
  try { 
    await connection.query("ALTER TABLE chat_messages ADD COLUMN seen_at DATETIME NULL"); 
    console.log("Added seen_at");
  } catch(e) { console.log("seen_at exists or error:", e.message); }
  
  console.log("Database schema fixed");
  process.exit(0);
}
fix();
