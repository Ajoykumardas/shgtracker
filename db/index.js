const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not set. Use the Supabase "Session pooler" connection string.');
  process.exit(1);
}

// Strip sslmode from the URL: newer pg treats sslmode=require as verify-full, which rejects Supabase's cert chain
const dbUrl = new URL(process.env.DATABASE_URL);
dbUrl.searchParams.delete('sslmode');

const isLocal = ['localhost', '127.0.0.1'].includes(dbUrl.hostname);

const pool = new Pool({
  connectionString: dbUrl.toString(),
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: 5
});

pool.on('error', err => console.error('Postgres pool error:', err.message));

async function init() {
  const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
  await pool.query(schema);
}

// Keep only { key: object } entries so malformed values can't reach the SQL casts
function objectEntries(map) {
  const clean = {};
  for (const [key, value] of Object.entries(map || {})) {
    if (key && value && typeof value === 'object' && !Array.isArray(value)) clean[key] = value;
  }
  return clean;
}

async function transaction(fn) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await fn(client);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/* ---------- Member reasons: { [memberCode]: { reason, remarks, updatedAt } } ---------- */

async function getReasons() {
  const { rows } = await pool.query('SELECT member_code, reason, remarks, updated_at FROM member_reasons');
  const out = {};
  for (const r of rows) {
    out[r.member_code] = { reason: r.reason, remarks: r.remarks, updatedAt: r.updated_at.toISOString() };
  }
  return out;
}

// An empty reason means "cleared" and deletes the row
async function saveReasons(map) {
  const json = JSON.stringify(objectEntries(map));
  await transaction(async client => {
    await client.query(`
      INSERT INTO member_reasons (member_code, reason, remarks, updated_at)
      SELECT key, value->>'reason', COALESCE(value->>'remarks', ''),
             COALESCE((value->>'updatedAt')::timestamptz, now())
      FROM jsonb_each($1::jsonb)
      WHERE COALESCE(value->>'reason', '') <> ''
      ON CONFLICT (member_code) DO UPDATE
        SET reason = EXCLUDED.reason, remarks = EXCLUDED.remarks, updated_at = EXCLUDED.updated_at`, [json]);
    await client.query(`
      DELETE FROM member_reasons
      WHERE member_code IN (SELECT key FROM jsonb_each($1::jsonb) WHERE COALESCE(value->>'reason', '') = '')`, [json]);
  });
}

/* ---------- SHG cutoff: { [shgCode]: { "12.08.2026": "Yes", ..., updatedAt } } ---------- */

async function getCutoff() {
  const { rows } = await pool.query('SELECT shg_code, dates, updated_at FROM shg_cutoff_responses');
  const out = {};
  for (const r of rows) {
    out[r.shg_code] = { ...r.dates, updatedAt: r.updated_at.toISOString() };
  }
  return out;
}

// An entry with no dates means "cleared" and deletes the row
async function saveCutoff(map) {
  const json = JSON.stringify(objectEntries(map));
  await transaction(async client => {
    await client.query(`
      INSERT INTO shg_cutoff_responses (shg_code, dates, updated_at)
      SELECT key, value - 'updatedAt', COALESCE((value->>'updatedAt')::timestamptz, now())
      FROM jsonb_each($1::jsonb)
      WHERE value - 'updatedAt' <> '{}'::jsonb
      ON CONFLICT (shg_code) DO UPDATE
        SET dates = EXCLUDED.dates, updated_at = EXCLUDED.updated_at`, [json]);
    await client.query(`
      DELETE FROM shg_cutoff_responses
      WHERE shg_code IN (SELECT key FROM jsonb_each($1::jsonb) WHERE value - 'updatedAt' = '{}'::jsonb)`, [json]);
  });
}

/* ---------- Lakhpati inactive: { [pldCode]: { needInactive, updatedAt } } ---------- */

async function getLakhpati() {
  const { rows } = await pool.query('SELECT pld_code, need_inactive, updated_at FROM lakhpati_inactive');
  const out = {};
  for (const r of rows) {
    out[r.pld_code] = { needInactive: r.need_inactive, updatedAt: r.updated_at.toISOString() };
  }
  return out;
}

async function saveLakhpati(map) {
  await pool.query(`
    INSERT INTO lakhpati_inactive (pld_code, need_inactive, updated_at)
    SELECT key, COALESCE((value->>'needInactive')::boolean, false),
           COALESCE((value->>'updatedAt')::timestamptz, now())
    FROM jsonb_each($1::jsonb)
    ON CONFLICT (pld_code) DO UPDATE
      SET need_inactive = EXCLUDED.need_inactive, updated_at = EXCLUDED.updated_at`,
    [JSON.stringify(objectEntries(map))]);
}

async function counts() {
  const { rows } = await pool.query(`
    SELECT (SELECT count(*) FROM member_reasons)::int       AS reasons,
           (SELECT count(*) FROM shg_cutoff_responses)::int AS cutoff,
           (SELECT count(*) FROM lakhpati_inactive)::int    AS lakhpati`);
  return rows[0];
}

module.exports = {
  pool, init, counts,
  getReasons, saveReasons,
  getCutoff, saveCutoff,
  getLakhpati, saveLakhpati
};
