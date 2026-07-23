-- Koenigsburg - build-project material planner.
-- Run in the Supabase SQL editor after schema.sql and migrations 002-012.
-- Safe to run repeatedly: no existing project data is dropped.
--
-- A build project declares how much of each item it needs. The allocation
-- engine (lib/builds.ts) shares the QMSync inventory pool across every active
-- project in priority order, so one stack of iron is never promised twice.
-- Allocation itself is computed in the app; these tables only hold the
-- requirements, the priority order, and the per-item lock / manual override.

CREATE TABLE IF NOT EXISTS build_projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    description TEXT,
    -- active   → included in allocation, lower priority number = claims first
    -- archived → hidden from allocation, kept for reference
    -- completed→ finished, released from the pool
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'archived', 'completed')),
    priority INTEGER NOT NULL DEFAULT 0,
    created_by UUID REFERENCES players(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_build_projects_priority
    ON build_projects(status, priority, created_at);

CREATE TABLE IF NOT EXISTS build_project_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES build_projects(id) ON DELETE CASCADE,
    -- Namespaced Minecraft id, e.g. minecraft:iron_ingot. Matches the id the
    -- QMSync ledger stores, so allocation can join against live stock.
    item_id VARCHAR(160) NOT NULL,
    display_name VARCHAR(120) NOT NULL,
    required_quantity BIGINT NOT NULL CHECK (required_quantity > 0),
    -- When set, the engine reserves this exact amount (capped by requirement and
    -- live stock) instead of the greedy "take what's needed" figure.
    manual_override BIGINT CHECK (manual_override IS NULL OR manual_override >= 0),
    -- Locked lines claim their share of the pool BEFORE any unlocked line, in
    -- priority order — a way to guarantee a critical material for one project.
    locked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (project_id, item_id)
);

CREATE INDEX IF NOT EXISTS idx_build_project_items_project
    ON build_project_items(project_id);
CREATE INDEX IF NOT EXISTS idx_build_project_items_item
    ON build_project_items(item_id);

ALTER TABLE build_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE build_project_items ENABLE ROW LEVEL SECURITY;
-- No browser policies on purpose: reads and writes go through the server-only
-- service-role client, exactly like the rest of the portal's data.

-- Live stock per item across the whole configured server, summed over every
-- container. display_name is a representative label (the variant with the most
-- of that item). The planner joins this against each project's requirements.
CREATE OR REPLACE FUNCTION get_available_inventory(
    p_server_id TEXT
) RETURNS TABLE (
    item_id TEXT,
    display_name TEXT,
    available BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
    SELECT
        i.item_id::TEXT,
        (ARRAY_AGG(i.display_name ORDER BY i.quantity DESC))[1]::TEXT,
        SUM(i.quantity)::BIGINT
    FROM inventory_items i
    JOIN inventory_containers c ON c.id = i.container_id
    WHERE p_server_id IS NULL OR c.server_id = p_server_id
    GROUP BY i.item_id;
$$;

REVOKE ALL ON FUNCTION get_available_inventory(TEXT)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_available_inventory(TEXT) TO service_role;
