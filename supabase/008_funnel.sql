-- Koenigsburg - recruitment funnel analytics.
-- Run once in the Supabase SQL editor. Safe to run repeatedly.
--
-- Lightweight, anonymous step tracking so admins can see WHERE visitors drop
-- off (landing -> quiz -> signup) before they ever create a player row. The
-- post-signup steps (signed up / verified / active) are read straight from the
-- players table, so they aren't logged here. No PII: visit_id is a random
-- client-generated token, never tied to a person.

CREATE TABLE IF NOT EXISTS funnel_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event VARCHAR(40) NOT NULL,          -- landing_view | quiz_start | quiz_finish | signup_view | discord_click
    visit_id VARCHAR(64) NOT NULL,       -- anonymous per-browser token, for distinct-visitor counts
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_funnel_event_time ON funnel_events(event, created_at);
CREATE INDEX IF NOT EXISTS idx_funnel_visit ON funnel_events(visit_id);

ALTER TABLE funnel_events ENABLE ROW LEVEL SECURITY;
