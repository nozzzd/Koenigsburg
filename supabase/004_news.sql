-- Koenigsburg - the Herald (news / newsletter), admin-written.
-- Run once in the Supabase SQL editor. Safe to run repeatedly.

CREATE TABLE IF NOT EXISTS news (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(160) NOT NULL,
    summary TEXT,                                   -- short blurb for the feed
    body TEXT NOT NULL,                             -- full article
    image_url TEXT,
    author VARCHAR(120),
    pinned BOOLEAN DEFAULT FALSE NOT NULL,          -- "important" — floats to the top
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Feed order: pinned first, then newest.
CREATE INDEX IF NOT EXISTS idx_news_feed ON news(pinned DESC, created_at DESC);

-- Read through the server's service-role key, same as players/projects.
ALTER TABLE news ENABLE ROW LEVEL SECURITY;
