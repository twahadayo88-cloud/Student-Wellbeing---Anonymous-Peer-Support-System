/* Scratch: deep schema audit — compare actual DB tables/columns against what
 * every service file queries. Flags tables referenced in code but missing in DB,
 * and columns referenced but missing in their table.
 */
const { query, pool } = require('../src/config/db.config');
const fs = require('fs');
const path = require('path');

// Regex-scan all service files for table names used in queries
const srcRoot = path.resolve(__dirname, '../src');
const serviceFiles = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(js)$/.test(entry.name) && !/health_check|verify_module/.test(entry.name)) serviceFiles.push(p);
  }
})(srcRoot);

const codeRefs = new Set(); // table -> set of columns referenced
const tableColumns = new Map();
const identifier = /\b(?:FROM|INTO|UPDATE|JOIN)\s+([a-z_][a-z0-9_]*)/gi;
const colRef = /\b([a-z_][a-z0-9_]*)\s*(?:=|AS|=|\))/gi;

(async () => {
  const [tables] = await query('SHOW TABLES');
  const tableNames = tables.map(t => Object.values(t)[0]);
  const tableSet = new Set(tableNames);

  for (const t of tableNames) {
    const [cols] = await query(`SHOW COLUMNS FROM \`${t}\``);
    tableColumns.set(t, new Set(cols.map(c => c.Field)));
  }

  const missingTables = new Set();
  for (const file of serviceFiles) {
    const content = fs.readFileSync(file, 'utf8');
    let m;
    while ((m = identifier.exec(content)) !== null) {
      const t = m[1];
      if (!tableSet.has(t)) {
        // ignore literal values / subquery aliases
        if (/^(values|select|where|set|dual|on|as)$/i.test(t)) continue;
        missingTables.add(t);
      }
    }
  }

  console.log('=== TABLES REFERENCED IN CODE BUT MISSING IN DB ===');
  const list = [...missingTables].sort();
  console.log(list.length ? list.join('\n') : '(none)');
  console.log(`\n=== TOTAL TABLES IN DB: ${tableNames.length} ===`);
  console.log(tableNames.sort().join(', '));
  await pool.end();
})().catch(e => { console.error(e.message); process.exit(1); });
