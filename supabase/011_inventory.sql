-- Koenigsburg - searchable QMSync inventory ledger.
-- Run in the Supabase SQL editor after schema.sql and migrations 002-010.
-- Safe to run repeatedly: no existing inventory data is dropped.

-- QMSync identifies a player by their Mojang UUID. The first authenticated
-- sync links that UUID to an already-active portal player with the same IGN;
-- subsequent syncs use the UUID as the stable identity (IGNs can change).
ALTER TABLE players
    ADD COLUMN IF NOT EXISTS minecraft_uuid UUID;

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_minecraft_uuid
    ON players(minecraft_uuid)
    WHERE minecraft_uuid IS NOT NULL;

-- One row per QMSync installation/memory bank. A player can sync from more
-- than one computer, while source_key stays unique for that player + server.
CREATE TABLE IF NOT EXISTS inventory_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id VARCHAR(80) NOT NULL,
    player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    player_uuid UUID NOT NULL,
    player_ign VARCHAR(16) NOT NULL,
    source_key VARCHAR(120) NOT NULL,
    source_label VARCHAR(80),
    protocol_version SMALLINT DEFAULT 1 NOT NULL,
    last_sync_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (server_id, player_id, source_key)
);

-- A container is identified by its exact block position on one configured
-- server. Newer observations replace older ones; stale uploads are ignored.
CREATE TABLE IF NOT EXISTS inventory_containers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id VARCHAR(80) NOT NULL,
    source_id UUID REFERENCES inventory_sources(id) ON DELETE SET NULL,
    dimension VARCHAR(100) NOT NULL,
    block_x INTEGER NOT NULL,
    block_y INTEGER NOT NULL,
    block_z INTEGER NOT NULL,
    container_type VARCHAR(160) NOT NULL,
    container_name VARCHAR(120),
    observed_at TIMESTAMP WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (server_id, dimension, block_x, block_y, block_z)
);

-- Counts are already combined per item/display-name variant by the receiver.
-- A child table makes replacing one container snapshot atomic and keeps search
-- fast without retaining stale slots from its previous observation.
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    container_id UUID NOT NULL REFERENCES inventory_containers(id) ON DELETE CASCADE,
    item_id VARCHAR(160) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    quantity BIGINT NOT NULL CHECK (quantity > 0),
    UNIQUE (container_id, item_id, display_name)
);

CREATE INDEX IF NOT EXISTS idx_inventory_sources_server
    ON inventory_sources(server_id, last_sync_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_containers_server_seen
    ON inventory_containers(server_id, observed_at DESC);
CREATE INDEX IF NOT EXISTS idx_inventory_items_item_id
    ON inventory_items(item_id);
CREATE INDEX IF NOT EXISTS idx_inventory_items_display_name
    ON inventory_items(display_name);

ALTER TABLE inventory_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
-- No browser policies on purpose. The public page and QMSync receiver both use
-- the server-only service-role client; anon/authenticated keys cannot read or
-- write the ledger directly.

-- Replace one container and all of its item rows in a single transaction.
-- ON CONFLICT's WHERE clause is also the race-safe "newest observation wins"
-- gate: a concurrent stale request gets no RETURNING row and changes nothing.
CREATE OR REPLACE FUNCTION replace_inventory_container(
    p_server_id TEXT,
    p_source_id UUID,
    p_dimension TEXT,
    p_block_x INTEGER,
    p_block_y INTEGER,
    p_block_z INTEGER,
    p_container_type TEXT,
    p_container_name TEXT,
    p_observed_at TIMESTAMP WITH TIME ZONE,
    p_items JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_container_id UUID;
BEGIN
    INSERT INTO inventory_containers (
        server_id,
        source_id,
        dimension,
        block_x,
        block_y,
        block_z,
        container_type,
        container_name,
        observed_at,
        updated_at
    ) VALUES (
        p_server_id,
        p_source_id,
        p_dimension,
        p_block_x,
        p_block_y,
        p_block_z,
        p_container_type,
        NULLIF(BTRIM(p_container_name), ''),
        p_observed_at,
        TIMEZONE('utc'::text, NOW())
    )
    ON CONFLICT (server_id, dimension, block_x, block_y, block_z)
    DO UPDATE SET
        source_id = EXCLUDED.source_id,
        container_type = EXCLUDED.container_type,
        container_name = EXCLUDED.container_name,
        observed_at = EXCLUDED.observed_at,
        updated_at = EXCLUDED.updated_at
    WHERE inventory_containers.observed_at < EXCLUDED.observed_at
    RETURNING id INTO v_container_id;

    IF v_container_id IS NULL THEN
        RETURN FALSE;
    END IF;

    DELETE FROM inventory_items WHERE container_id = v_container_id;

    INSERT INTO inventory_items (container_id, item_id, display_name, quantity)
    SELECT
        v_container_id,
        LEFT(BTRIM(item.item_id), 160),
        LEFT(BTRIM(item.display_name), 120),
        SUM(item.quantity)::BIGINT
    FROM jsonb_to_recordset(COALESCE(p_items, '[]'::JSONB)) AS item(
        item_id TEXT,
        display_name TEXT,
        quantity BIGINT
    )
    WHERE
        item.quantity > 0
        AND NULLIF(BTRIM(item.item_id), '') IS NOT NULL
        AND NULLIF(BTRIM(item.display_name), '') IS NOT NULL
    GROUP BY LEFT(BTRIM(item.item_id), 160), LEFT(BTRIM(item.display_name), 120);

    RETURN TRUE;
END;
$$;

-- Flatten item + location rows for the website. Keeping the user query as a
-- function argument avoids constructing PostgREST filter syntax from input.
CREATE OR REPLACE FUNCTION search_inventory(
    p_query TEXT,
    p_server_id TEXT,
    p_limit INTEGER DEFAULT 100
) RETURNS TABLE (
    container_id UUID,
    item_id TEXT,
    display_name TEXT,
    quantity BIGINT,
    server_id TEXT,
    dimension TEXT,
    block_x INTEGER,
    block_y INTEGER,
    block_z INTEGER,
    container_type TEXT,
    container_name TEXT,
    observed_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        c.id,
        i.item_id::TEXT,
        i.display_name::TEXT,
        i.quantity,
        c.server_id::TEXT,
        c.dimension::TEXT,
        c.block_x,
        c.block_y,
        c.block_z,
        c.container_type::TEXT,
        c.container_name::TEXT,
        c.observed_at
    FROM inventory_items i
    JOIN inventory_containers c ON c.id = i.container_id
    WHERE
        (p_server_id IS NULL OR c.server_id = p_server_id)
        AND (
            NULLIF(BTRIM(p_query), '') IS NULL
            OR POSITION(LOWER(BTRIM(p_query)) IN LOWER(i.item_id)) > 0
            OR POSITION(LOWER(BTRIM(p_query)) IN LOWER(i.display_name)) > 0
        )
    ORDER BY
        CASE
            WHEN NULLIF(BTRIM(p_query), '') IS NULL THEN 2
            WHEN LOWER(i.item_id) = LOWER(BTRIM(p_query)) THEN 0
            WHEN LOWER(i.display_name) = LOWER(BTRIM(p_query)) THEN 1
            ELSE 2
        END,
        c.observed_at DESC,
        i.quantity DESC,
        i.display_name ASC
    LIMIT LEAST(GREATEST(COALESCE(p_limit, 100), 1), 100);
$$;

CREATE OR REPLACE FUNCTION get_inventory_stats(
    p_server_id TEXT
) RETURNS TABLE (
    stored_items BIGINT,
    unique_items BIGINT,
    containers BIGINT,
    memory_banks BIGINT,
    last_snapshot_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        COALESCE(SUM(i.quantity), 0)::BIGINT,
        COUNT(DISTINCT i.item_id)::BIGINT,
        COUNT(DISTINCT c.id)::BIGINT,
        (
            SELECT COUNT(*)::BIGINT
            FROM inventory_sources s
            WHERE p_server_id IS NULL OR s.server_id = p_server_id
        ),
        MAX(c.observed_at)
    FROM inventory_containers c
    LEFT JOIN inventory_items i ON i.container_id = c.id
    WHERE p_server_id IS NULL OR c.server_id = p_server_id;
$$;

REVOKE ALL ON FUNCTION replace_inventory_container(
    TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT,
    TIMESTAMP WITH TIME ZONE, JSONB
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION search_inventory(TEXT, TEXT, INTEGER)
    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION get_inventory_stats(TEXT)
    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION replace_inventory_container(
    TEXT, UUID, TEXT, INTEGER, INTEGER, INTEGER, TEXT, TEXT,
    TIMESTAMP WITH TIME ZONE, JSONB
) TO service_role;
GRANT EXECUTE ON FUNCTION search_inventory(TEXT, TEXT, INTEGER)
    TO service_role;
GRANT EXECUTE ON FUNCTION get_inventory_stats(TEXT)
    TO service_role;
