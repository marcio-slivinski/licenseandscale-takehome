-- Migration 002 — Catalog sync from Google Sheet (published CSV URL)
-- Single-row config table (enforced by CHECK + ON CONFLICT).
-- Run after the base schema.sql.

CREATE TABLE IF NOT EXISTS catalog_sync_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  sheet_csv_url TEXT,
  last_synced_at TIMESTAMPTZ,
  last_result JSONB,                -- { ok, inserted, updated, skipped[], error? }
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO catalog_sync_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
