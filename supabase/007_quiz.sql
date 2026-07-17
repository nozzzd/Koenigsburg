-- Koenigsburg - Nation Role Alignment Quiz.
-- Run once in the Supabase SQL editor. Safe to run repeatedly.
--
-- Two pieces:
--   1. quiz_role_map  - admin-set mapping of each quiz archetype to a real team.
--      When a recruit finishes the quiz and signs up "as a Builder", the mapped
--      team is what they get added to on approval.
--   2. players.pending_team_id - the team a still-pending recruit elected via the
--      quiz. Applied (and cleared) when an admin approves them.

CREATE TABLE IF NOT EXISTS quiz_role_map (
    archetype VARCHAR(32) PRIMARY KEY,              -- 'builder' | 'fighter' | ...
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- The team a pending player chose from their quiz result. NULL for normal
-- signups. ON DELETE SET NULL so disbanding a team doesn't wedge approval.
ALTER TABLE players
    ADD COLUMN IF NOT EXISTS pending_team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

ALTER TABLE quiz_role_map ENABLE ROW LEVEL SECURITY;
