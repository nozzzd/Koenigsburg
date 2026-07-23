-- Koenigsburg - the Ledger (tasks & goals).
-- Run once in the Supabase SQL editor. Safe to run repeatedly.
--
-- Three kinds of entry, distinguished by `scope`:
--   personal - a member's own to-do; they own it outright
--   assigned - set BY an admin FOR one member; they tick it, only admins remove it
--   realm    - a general goal every citizen sees (player_id IS NULL)

DO $$ BEGIN
    CREATE TYPE task_scope AS ENUM ('personal', 'assigned', 'realm');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    scope task_scope DEFAULT 'personal' NOT NULL,
    -- Whose list it sits on. NULL for realm-wide goals.
    -- CASCADE: a member who leaves takes their tasks with them.
    player_id UUID REFERENCES players(id) ON DELETE CASCADE,
    -- Which elder set it (assigned/realm only). Survives that elder leaving.
    assigned_by UUID REFERENCES players(id) ON DELETE SET NULL,
    done BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tasks_player ON tasks(player_id, done, created_at);
CREATE INDEX IF NOT EXISTS idx_tasks_scope ON tasks(scope, done, created_at);

-- Read through the server's service-role key, same as the other tables.
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
