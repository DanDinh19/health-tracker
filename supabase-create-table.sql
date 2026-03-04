-- Run this in Supabase Dashboard → SQL Editor → New query
-- Creates the health_entries table so the app can save entries

CREATE TABLE IF NOT EXISTS public.health_entries (
  id         TEXT PRIMARY KEY,
  type       TEXT NOT NULL,
  value      DOUBLE PRECISION NOT NULL,
  unit       TEXT,
  "recordedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note       TEXT
);
