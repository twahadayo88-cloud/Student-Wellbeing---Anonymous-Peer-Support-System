require('dotenv').config();
const mysql = require('mysql2/promise');
const env = require('./config/env.config');

const REQUIRED_TABLES = [
  'users', 'profiles', 'anonymous_id_map', 'chat_requests', 'feedback', 
  'chat_messages', 'mood_entries', 'scheduled_tasks',
  'blacklisted_tokens', 'notifications', 'trust_scores', 'violation_history', 'peer_matches'
];

async function runHealthCheck() {
  console.log('🔄 Starting Database Health Check...\n');
  
  let connection;
  try {
    connection = await mysql.createConnection({
      host: env.db.host,
      user: env.db.user,
      password: env.db.password,
      database: env.db.name,
    });
    
    console.log('✅ Connected to MySQL Database\n');

    const [tablesData] = await connection.query('SHOW TABLES');
    const existingTables = tablesData.map(t => Object.values(t)[0]);

    console.log('📋 TABLE CHECK:');
    let missingTables = [];
    for (const table of REQUIRED_TABLES) {
      if (existingTables.includes(table)) {
        console.log(`  [OK] ${table} exists`);
      } else {
        console.log(`  [MISSING] ${table}`);
        missingTables.push(table);
      }
    }
    console.log();

    console.log('📋 ENUM & COLUMN CHECKS:');
    
    // Check users ENUM
    if (existingTables.includes('users')) {
      const [colData] = await connection.query(`SHOW COLUMNS FROM users WHERE Field = 'role'`);
      if (colData.length) {
        console.log(`  [USERS] role ENUM defined as: ${colData[0].Type}`);
        const type = colData[0].Type;
        const expectedRoles = ['student', 'faculty', 'admin', 'super_admin'];
        if (!expectedRoles.every(role => type.includes(role))) {
          console.log(`    ❌ Role ENUM does not contain exactly the supported application roles`);
        } else {
          console.log(`    ✅ ENUM values match requirements`);
        }
      }
    }

    // Check profiles columns
    if (existingTables.includes('profiles')) {
      const requiredProfileCols = [
        'is_first_login', 'onboarding_complete', 'consent_mood_data', 
        'consent_analytics', 'trust_score', 'skills', 'subjects', 'semester', 
        'department', 'designation', 'office_hours', 'bio'
      ];
      const [cols] = await connection.query('SHOW COLUMNS FROM profiles');
      const colNames = cols.map(c => c.Field);
      
      let missingCols = [];
      for (const col of requiredProfileCols) {
        if (!colNames.includes(col)) {
           missingCols.push(col);
        }
      }
      if (missingCols.length) {
        console.log(`  [PROFILES] Missing columns: ${missingCols.join(', ')}`);
      } else {
        console.log(`  [PROFILES] ✅ All required columns exist`);
      }
    }

    // Check feedback unique constraint
    if (existingTables.includes('feedback')) {
      const [indexes] = await connection.query('SHOW INDEX FROM feedback');
      const hasUnique = indexes.some(idx => idx.Key_name !== 'PRIMARY' && !idx.Non_unique);
      if (hasUnique) {
         console.log(`  [FEEDBACK] ✅ Unique constraint exists`);
      } else {
         console.log(`  [FEEDBACK] ❌ Missing Unique constraint on (from_user, request_id)`);
      }
    }

    console.log('\n✅ Health check complete.');
  } catch (err) {
    console.error('❌ Database connection failed:', err.message);
  } finally {
    if (connection) await connection.end();
  }
}

runHealthCheck();
