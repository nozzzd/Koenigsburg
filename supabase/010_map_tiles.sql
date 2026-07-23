-- Koenigsburg - community-sourced world map (Xaero tiles).
-- Run once in the Supabase SQL editor. Safe to run repeatedly.
--
-- The world is diced into 512x512-block regions (Xaero's native region size).
-- Citizens select their Xaero's World Map folder on /map/contribute; their
-- browser parses each region file, renders it to a PNG tile, and uploads it to
-- the `map-tiles` bucket. The `map_tiles.storage_path` row points at the
-- currently published object for each region.
-- One row per region cell. `captured_at` is the region file's own modification
-- time - a tile only replaces the stored one when its capture date is NEWER,
-- so a re-upload of an old map can never wipe fresher scouting. The public
-- /map page reassembles the tiles by their coordinates.

CREATE TABLE IF NOT EXISTS map_tiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dimension VARCHAR(20) NOT NULL DEFAULT 'overworld',  -- overworld | nether | end
    region_x INTEGER NOT NULL,          -- Xaero region coordinate (block coord / 512, floored)
    region_z INTEGER NOT NULL,
    storage_path TEXT NOT NULL,         -- current object path within the map-tiles bucket
    contributor_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    contributor_ign VARCHAR(32),        -- denormalised so credit survives a player delete
    -- When the terrain was actually seen in-game (the region file's mtime,
    -- server-clamped against future dates). THE merge key: newest wins.
    captured_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    -- One tile per cell; a fresher capture of the same region replaces it.
    UNIQUE (dimension, region_x, region_z)
);

-- In case an earlier revision of this migration (without captured_at) was run.
ALTER TABLE map_tiles ADD COLUMN IF NOT EXISTS captured_at
    TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL;

CREATE INDEX IF NOT EXISTS idx_map_tiles_dimension ON map_tiles(dimension);

ALTER TABLE map_tiles ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: every read/write goes through the server-only
-- service-role client, which bypasses RLS. The browser never touches this table.

-- Public-read storage bucket for the tile images. Public so the assembled map
-- (and the "download full map" button) work for everyone, logged in or not, and
-- keep working after the event. Writes are service-role only; the table row
-- chooses which uploaded object is currently published for each region.
INSERT INTO storage.buckets (id, name, public)
VALUES ('map-tiles', 'map-tiles', true)
ON CONFLICT (id) DO NOTHING;
