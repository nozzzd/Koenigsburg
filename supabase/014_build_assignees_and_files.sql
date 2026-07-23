-- Koenigsburg - build-planner: per-resource assignees + Litematica files.
-- Run in the Supabase SQL editor after 013_build_projects.sql.
-- Safe to run repeatedly.
--
-- Two additions on top of the planner:
--   1. Each requirement line can name who is responsible for gathering it -
--      a whole team OR a single player (never both). Purely informational;
--      it does not change allocation.
--   2. A project can carry uploaded Litematica schematic files that citizens
--      download from the read-only project view. Metadata lives here; the file
--      objects live in the public-read `build-files` storage bucket.

-- 1. Assignees ------------------------------------------------------------
ALTER TABLE build_project_items
    ADD COLUMN IF NOT EXISTS assigned_team_id UUID
        REFERENCES teams(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS assigned_player_id UUID
        REFERENCES players(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_build_items_assigned_team
    ON build_project_items(assigned_team_id);
CREATE INDEX IF NOT EXISTS idx_build_items_assigned_player
    ON build_project_items(assigned_player_id);

-- 2. Litematica / schematic files ----------------------------------------
CREATE TABLE IF NOT EXISTS build_project_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES build_projects(id) ON DELETE CASCADE,
    -- Original file name as shown to citizens (e.g. "cathedral.litematic").
    file_name VARCHAR(200) NOT NULL,
    -- Object path within the `build-files` storage bucket.
    storage_path TEXT NOT NULL,
    size_bytes BIGINT NOT NULL DEFAULT 0 CHECK (size_bytes >= 0),
    content_type VARCHAR(120),
    uploaded_by UUID REFERENCES players(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_build_project_files_project
    ON build_project_files(project_id, created_at DESC);

ALTER TABLE build_project_files ENABLE ROW LEVEL SECURITY;
-- No browser policies: reads/writes go through the server-only service-role
-- client, like the rest of the planner. The bucket below is public-read so the
-- download links work directly.

-- Public-read storage bucket for the schematic files. Public so a citizen can
-- download a Litematica file straight from the project page. Writes are
-- service-role only. If the hosted project blocks this INSERT, create the
-- bucket by hand in Storage → New bucket (name `build-files`, Public on).
INSERT INTO storage.buckets (id, name, public)
VALUES ('build-files', 'build-files', true)
ON CONFLICT (id) DO NOTHING;
