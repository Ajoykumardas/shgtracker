/**
 * One-off import of saved responses into Supabase Postgres.
 *
 * Source is either the live app's backup endpoint or a saved backup file:
 *   DATABASE_URL=... node scripts/import-backup.js https://<app>.onrender.com/api/backup
 *   DATABASE_URL=... node scripts/import-backup.js ./backup.json
 *
 * Accepts the /api/backup format: { reasons, cutoff, lakhpati }. Re-running is safe (upserts).
 */
const fs = require('fs');
const db = require('../db');

async function loadSource(src) {
  if (/^https?:\/\//.test(src)) {
    const res = await fetch(src);
    if (!res.ok) throw new Error(`GET ${src} returned ${res.status}`);
    return res.json();
  }
  return JSON.parse(fs.readFileSync(src, 'utf-8'));
}

async function main() {
  const src = process.argv[2];
  if (!src) {
    console.error('Usage: node scripts/import-backup.js <backup-url-or-file>');
    process.exit(1);
  }

  const backup = await loadSource(src);
  const size = obj => Object.keys(obj || {}).length;
  console.log(`Source has reasons: ${size(backup.reasons)}, cutoff: ${size(backup.cutoff)}, lakhpati: ${size(backup.lakhpati)}`);

  await db.init();
  if (backup.reasons)  await db.saveReasons(backup.reasons);
  if (backup.cutoff)   await db.saveCutoff(backup.cutoff);
  if (backup.lakhpati) await db.saveLakhpati(backup.lakhpati);

  console.log('Database now has:', await db.counts());
}

main()
  .catch(err => {
    console.error('Import failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => db.pool.end());
