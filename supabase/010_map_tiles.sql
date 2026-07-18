-- Koenigsburg - community-sourced world map (Xaero tiles).
-- Run once in the Supabase SQL editor. Safe to run repeatedly.
--
-- The world is diced into 512x512-block regions (Xaero's native region size).
-- Citizens export their Xaero's World Map to PNG, the browser slices it into
-- region-aligned tiles, and each tile is uploaded to the `map-tiles` bucket at a
-- deterministic path (overworld/<rx>_<rz>.png). One row per region cell; a new
-- upload UPSERTs it, so the NEWEST tile per cell always wins. The public /map
-- page reassembles the tiles by their coordinates.

CREATE TABLE IF NOT EXISTS map_tiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dimension VARCHAR(20) NOT NULL DEFAULT 'overworld',  -- overworld | nether | end
    region_x INTEGER NOT NULL,          -- Xaero region coordinate (block coord / 512, floored)
    region_z INTEGER NOT NULL,
    storage_path TEXT NOT NULL,         -- object path within the map-tiles bucket
    contributor_player_id UUID REFERENCES players(id) ON DELETE SET NULL,
    contributor_ign VARCHAR(32),        -- denormalised so credit survives a player delete
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    -- One tile per cell; a re-upload of the same region replaces it (newest wins).
    UNIQUE (dimension, region_x, region_z)
);

CREATE INDEX IF NOT EXISTS idx_map_tiles_dimension ON map_tiles(dimension);

ALTER TABLE map_tiles ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: every read/write goes through the server-only
-- service-role client, which bypasses RLS. The browser never touches this table.

-- Public-read storage bucket for the tile images. Public so the assembled map
-- (and the "download full map" button) work for everyone, logged in or not, and
-- keep working after the event. Writes are service-role only (upsert overwrite).
INSERT INTO storage.buckets (id, name, public)
VALUES ('map-tiles', 'map-tiles', true)
ON CONFLICT (id) DO NOTHING;
