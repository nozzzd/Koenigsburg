-- Koenigsburg - teams / guilds, with optional Discord role sync.
-- Run once in the Supabase SQL editor. Safe to run repeatedly.
--
-- A team may mirror a Discord role: creating one can create the role, joining
-- the team assigns it, leaving strips it. discord_role_id is NULL for
-- website-only teams.

CREATE TABLE IF NOT EXISTS teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(80) UNIQUE NOT NULL,
    description TEXT,
    color VARCHAR(7),                               -- hex, e.g. #d4af37 (also the Discord role colour)
    discord_role_id VARCHAR(255),                   -- NULL = website-only team
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    PRIMARY KEY (team_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_player ON team_members(player_id);

-- Tasks can now target a whole team. A team task lands on every member's Ledger.
ALTER TABLE tasks
    ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES teams(id) ON DELETE CASCADE;

-- Extend the scope enum with 'team' (idempotent — ignored if already present).
DO $$ BEGIN
    ALTER TYPE task_scope ADD VALUE IF NOT EXISTS 'team';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_tasks_team ON tasks(team_id, done, created_at);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
