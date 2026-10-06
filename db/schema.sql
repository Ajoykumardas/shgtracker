-- Saved responses for the SHG Block Tracker.
-- Idempotent: server.js runs this on every startup.

CREATE TABLE IF NOT EXISTS member_reasons (
  member_code TEXT PRIMARY KEY,
  reason      TEXT NOT NULL,
  remarks     TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- dates: { "12.08.2026": "Yes" | "No", ... }
CREATE TABLE IF NOT EXISTS shg_cutoff_responses (
  shg_code   TEXT PRIMARY KEY,
  dates      JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lakhpati_inactive (
  pld_code      TEXT PRIMARY KEY,
  need_inactive BOOLEAN NOT NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tables are only accessed by the Node server over a direct Postgres connection.
-- Enabling RLS with no policies blocks Supabase's public REST API (anon key) from touching them.
ALTER TABLE member_reasons       ENABLE ROW LEVEL SECURITY;
ALTER TABLE shg_cutoff_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE lakhpati_inactive    ENABLE ROW LEVEL SECURITY;
