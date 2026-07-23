-- Koenigsburg - map atlas: countries, groups, markers and land claims.
-- Run once in the Supabase SQL editor. Safe to run repeatedly.
--
-- Everything the admins draw on the world map lives here. The public /map page
-- reads it through the server-only service-role client and filters SECRET rows
-- out BEFORE they ever reach a non-citizen's browser, so secret war plans can't
-- be found with inspect-element or the network tab.
--
--   map_layers  - a country (colour + claims + landmarks) or a generic group.
--   map_markers - an icon/label pin at a block coordinate, on one layer.
--   map_claims  - a polygon area (block coords) painted in its layer's colour.

-- A layer is either a 'country' (has a colour, holds claims + landmarks) or a
-- 'group' (a generic bucket of pins). secret => only active citizens may see it
-- or anything attached to it.
CREATE TABLE IF NOT EXISTS map_layers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    kind VARCHAR(12) NOT NULL DEFAULT 'group',        -- 'country' | 'group'
    name VARCHAR(60) NOT NULL,
    color VARCHAR(9) NOT NULL DEFAULT '#22c55e',      -- hex, e.g. #22c55e
    secret BOOLEAN NOT NULL DEFAULT FALSE,            -- hidden from non-citizens
    visible_default BOOLEAN NOT NULL DEFAULT TRUE,    -- initial toggle state
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- A pin. icon_kind chooses how `icon` is read:
--   'waypoint' - a plain diamond waypoint in the layer colour (icon ignored)
--   'symbol'   - a curated map symbol; `icon` is its key (e.g. 'castle')
--   'item'     - a Minecraft item icon; `icon` is the item id (e.g. 'diamond')
CREATE TABLE IF NOT EXISTS map_markers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer_id UUID NOT NULL REFERENCES map_layers(id) ON DELETE CASCADE,
    label VARCHAR(80) NOT NULL DEFAULT '',
    icon_kind VARCHAR(10) NOT NULL DEFAULT 'waypoint', -- 'waypoint'|'symbol'|'item'
    icon VARCHAR(160) NOT NULL DEFAULT '',
    x INTEGER NOT NULL,                                -- block X
    z INTEGER NOT NULL,                                -- block Z
    show_label BOOLEAN NOT NULL DEFAULT TRUE,
    show_icon BOOLEAN NOT NULL DEFAULT TRUE,
    secret BOOLEAN NOT NULL DEFAULT FALSE,             -- pin-level secrecy
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- A claimed area. `points` is a JSON array of [x, z] block-coordinate pairs
-- forming a closed polygon (the ring is closed implicitly).
CREATE TABLE IF NOT EXISTS map_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    layer_id UUID NOT NULL REFERENCES map_layers(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL DEFAULT '',
    points JSONB NOT NULL DEFAULT '[]'::jsonb,
    secret BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_map_markers_layer ON map_markers(layer_id);
CREATE INDEX IF NOT EXISTS idx_map_claims_layer ON map_claims(layer_id);

ALTER TABLE map_layers ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_markers ENABLE ROW LEVEL SECURITY;
ALTER TABLE map_claims ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: every read/write goes through the server-only
-- service-role client, which bypasses RLS. The browser never touches these
-- tables directly, and secret rows are filtered server-side before render.
