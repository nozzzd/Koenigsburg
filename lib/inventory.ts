import "server-only";

import { getSupabase } from "@/lib/supabase";

export interface InventoryStats {
  storedItems: number;
  uniqueItems: number;
  containers: number;
  memoryBanks: number;
  lastSnapshotAt: string | null;
}

export interface InventorySearchResult {
  container_id: string;
  item_id: string;
  display_name: string;
  quantity: number;
  server_id: string;
  dimension: string;
  block_x: number;
  block_y: number;
  block_z: number;
  container_type: string;
  container_name: string | null;
  observed_at: string;
}

export interface InventoryLedger {
  ready: boolean;
  receiverConfigured: boolean;
  realmName: string;
  stats: InventoryStats;
  results: InventorySearchResult[];
}

type StatsRow = {
  stored_items: number | string | null;
  unique_items: number | string | null;
  containers: number | string | null;
  memory_banks: number | string | null;
  last_snapshot_at: string | null;
};

const EMPTY_STATS: InventoryStats = {
  storedItems: 0,
  uniqueItems: 0,
  containers: 0,
  memoryBanks: 0,
  lastSnapshotAt: null,
};

function count(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

/**
 * Loads the public ledger through server-only RPCs. Missing migration or a
 * temporary database failure becomes a setup state instead of crashing the
 * public page.
 */
export async function getInventoryLedger(rawQuery: string): Promise<InventoryLedger> {
  const query = rawQuery.trim().slice(0, 80);
  const serverId = process.env.QMSYNC_SERVER_ID?.trim() || null;
  const receiverConfigured = Boolean(serverId);
  const realmName =
    process.env.QMSYNC_SERVER_NAME?.trim() ||
    process.env.QMSYNC_SERVER_ID?.trim() ||
    "Königsburg";

  try {
    const supabase = getSupabase();
    const [statsResponse, searchResponse] = await Promise.all([
      supabase.rpc("get_inventory_stats", { p_server_id: serverId }),
      supabase.rpc("search_inventory", {
        p_query: query || null,
        p_server_id: serverId,
        p_limit: 100,
      }),
    ]);

    if (statsResponse.error || searchResponse.error) {
      console.error(
        "Inventory ledger query failed:",
        statsResponse.error ?? searchResponse.error
      );
      return {
        ready: false,
        receiverConfigured,
        realmName,
        stats: EMPTY_STATS,
        results: [],
      };
    }

    const rawStats = (statsResponse.data as StatsRow[] | null)?.[0];
    const rawResults =
      (searchResponse.data as Array<
        Omit<InventorySearchResult, "quantity"> & {
          quantity: number | string;
        }
      > | null) ?? [];

    return {
      ready: true,
      receiverConfigured,
      realmName,
      stats: {
        storedItems: count(rawStats?.stored_items),
        uniqueItems: count(rawStats?.unique_items),
        containers: count(rawStats?.containers),
        memoryBanks: count(rawStats?.memory_banks),
        lastSnapshotAt: rawStats?.last_snapshot_at ?? null,
      },
      results: rawResults.map((row) => ({
        ...row,
        quantity: count(row.quantity),
      })),
    };
  } catch (error) {
    console.error("Inventory ledger unavailable:", error);
    return {
      ready: false,
      receiverConfigured,
      realmName,
      stats: EMPTY_STATS,
      results: [],
    };
  }
}
