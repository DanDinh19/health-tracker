-- Run in Supabase Dashboard → SQL Editor
-- Creates sleep_data table for granular sleep dashboard
-- sleep_stages: array of 1-4 (1=Awake, 2=Light, 3=Deep, 4=REM), each = 5 min interval
-- total_sleep_time, awake_time: seconds

CREATE TABLE IF NOT EXISTS public.sleep_data (
  id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       TEXT NOT NULL,
  day           DATE NOT NULL,
  sleep_stages  INTEGER[] NOT NULL DEFAULT '{}',
  sleep_score   INTEGER,
  total_sleep_time INTEGER,
  awake_time    INTEGER,
  avg_hr        NUMERIC(5,2),
  bedtime_start TIMESTAMPTZ,
  bedtime_end   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, day)
);

CREATE INDEX IF NOT EXISTS idx_sleep_data_user_day ON public.sleep_data(user_id, day DESC);

ALTER TABLE public.sleep_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own sleep_data"
  ON public.sleep_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own sleep_data"
  ON public.sleep_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own sleep_data"
  ON public.sleep_data FOR UPDATE
  USING (auth.uid() = user_id);
