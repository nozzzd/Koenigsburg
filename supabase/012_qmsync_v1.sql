-- Koenigsburg - exact QMSync protocol v1 full-snapshot storage.
-- Run after 011_inventory.sql.
-- Safe to run repeatedly.

-- QMSync sends a complete snapshot, not a delta. Replace every row currently
-- owned by this source in one transaction so removed containers disappear and
-- a malformed/failed replacement cannot leave a partial snapshot behind.
CREATE OR REPLACE FUNCTION replace_inventory_snapshot(
    p_server_id TEXT,
    p_source_id UUID,
    p_containers JSONB
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    v_container JSONB;
    v_saved INTEGER := 0;
BEGIN
    IF JSONB_TYPEOF(COALESCE(p_containers, '[]'::JSONB)) <> 'array' THEN
        RAISE EXCEPTION 'p_containers must be a JSON array';
    END IF;

    -- Serializes replacements from the same player/source.
    PERFORM 1
    FROM inventory_sources
    WHERE id = p_source_id AND server_id = p_server_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'inventory source does not exist for this server';
    END IF;

    DELETE FROM inventory_containers
    WHERE server_id = p_server_id AND source_id = p_source_id;

    FOR v_container IN
        SELECT value
        FROM JSONB_ARRAY_ELEMENTS(COALESCE(p_containers, '[]'::JSONB))
    LOOP
        IF replace_inventory_container(
            p_server_id,
            p_source_id,
            v_container ->> 'dimension',
            (v_container ->> 'block_x')::INTEGER,
            (v_container ->> 'block_y')::INTEGER,
            (v_container ->> 'block_z')::INTEGER,
            v_container ->> 'container_type',
            v_container ->> 'container_name',
            (v_container ->> 'observed_at')::TIMESTAMP WITH TIME ZONE,
            COALESCE(v_container -> 'items', '[]'::JSONB)
        ) THEN
            v_saved := v_saved + 1;
        END IF;
    END LOOP;

    RETURN v_saved;
END;
$$;

REVOKE ALL ON FUNCTION replace_inventory_snapshot(TEXT, UUID, JSONB)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION replace_inventory_snapshot(TEXT, UUID, JSONB)
    TO service_role;
