-- Run this in Supabase Dashboard → SQL Editor if you prefer SQL over Prisma db:push.
-- Creates users and oauth_states tables for Oura OAuth.

CREATE TABLE IF NOT EXISTS public.users (
  id                 TEXT PRIMARY KEY,
  "ouraAccessToken"  TEXT,
  "ouraRefreshToken" TEXT,
  "ouraTokenExpiresAt" TIMESTAMPTZ,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.oauth_states (
  id         TEXT PRIMARY KEY,
  state      TEXT NOT NULL UNIQUE,
  "userId"   TEXT NOT NULL,
  "expiresAt" TIMESTAMPTZ NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state ON public.oauth_states(state);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON public.oauth_states("expiresAt");
