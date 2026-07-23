import "server-only";

import { getSupabase, BUILD_FILES_BUCKET } from "@/lib/supabase";

export type BuildStatus = "active" | "archived" | "completed";

/** A raw build_projects row. */
export interface BuildProject {
  id: string;
  name: string;
  description: string | null;
  status: BuildStatus;
  priority: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** A raw build_project_items row. */
export interface BuildProjectItem {
  id: string;
  project_id: string;
  item_id: string;
  display_name: string;
  required_quantity: number;
  manual_override: number | null;
  locked: boolean;
  /** Optional responsibility - a whole team OR one player, never both. */
  assigned_team_id: string | null;
  assigned_player_id: string | null;
  created_at: string;
}

/** A raw build_project_files row (an uploaded Litematica / schematic). */
export interface BuildFile {
  id: string;
  project_id: string;
  file_name: string;
  storage_path: string;
  size_bytes: number;
  content_type: string | null;
  created_at: string;
}

/** One requirement after the shared pool has been distributed. */
export interface AllocatedItem {
  id: string;
  item_id: string;
  display_name: string;
  required: number;
  /** Total live stock of this item across the whole server. */
  available: number;
  /** How much of the pool this line reserved. */
  allocated: number;
  /** required − allocated, never negative. */
  missing: number;
  locked: boolean;
  override: number | null;
  assignedTeamId: string | null;
  assignedPlayerId: string | null;
}

export interface AllocatedProject {
  id: string;
  name: string;
  description: string | null;
  status: BuildStatus;
  priority: number;
  items: AllocatedItem[];
  requiredTotal: number;
  allocatedTotal: number;
  missingTotal: number;
  /** allocatedTotal / requiredTotal, 0..1 (1 when there is nothing to gather). */
  completion: number;
  /** True when every line is fully covered by reserved stock. */
  satisfied: boolean;
}

export interface Shortfall {
  item_id: string;
  display_name: string;
  missing: number;
}

export interface BuildOverview {
  /** False when the migration hasn't been run or the DB is unreachable. */
  ready: boolean;
  receiverConfigured: boolean;
  /** All projects, actives allocated against the shared live pool. */
  projects: AllocatedProject[];
  /** Unmet demand across active projects, largest first. */
  shortfalls: Shortfall[];
}

type PoolRow = { item_id: string; display_name: string | null; available: number | string | null };

function count(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 0;
}

function targetFor(item: BuildProjectItem): number {
  // A manual override reserves a fixed amount, but never more than the line
  // actually requires. A null override falls back to the full requirement.
  const desired = item.manual_override ?? item.required_quantity;
  return Math.max(0, Math.min(desired, item.required_quantity));
}

/**
 * Distributes a shared inventory pool across active projects.
 *
 * Order of claims:
 *   1. Every LOCKED line, in project-priority order, reserves its target first.
 *   2. Every remaining line, in project-priority order, takes what's left.
 *
 * Each item's stock is a single pool, so a stack promised to a high-priority
 * project can never be counted again for a lower one. Pure and deterministic -
 * given the same inputs it always returns the same allocation.
 */
export function allocateBuilds(
  projects: BuildProject[],
  itemsByProject: Map<string, BuildProjectItem[]>,
  pool: Map<string, number>
): AllocatedProject[] {
  const remaining = new Map(pool);
  const allocated = new Map<string, number>();

  const active = projects
    .filter((p) => p.status === "active")
    .sort(
      (a, b) => a.priority - b.priority || a.created_at.localeCompare(b.created_at)
    );

  for (const lockedPass of [true, false]) {
    for (const project of active) {
      for (const item of itemsByProject.get(project.id) ?? []) {
        if (item.locked !== lockedPass) continue;
        const want = targetFor(item);
        const have = remaining.get(item.item_id) ?? 0;
        const give = Math.max(0, Math.min(want, have));
        allocated.set(item.id, give);
        remaining.set(item.item_id, have - give);
      }
    }
  }

  return projects.map((project) => {
    const items: AllocatedItem[] = (itemsByProject.get(project.id) ?? []).map(
      (item) => {
        const give = allocated.get(item.id) ?? 0;
        return {
          id: item.id,
          item_id: item.item_id,
          display_name: item.display_name,
          required: item.required_quantity,
          available: pool.get(item.item_id) ?? 0,
          allocated: give,
          missing: Math.max(0, item.required_quantity - give),
          locked: item.locked,
          override: item.manual_override,
          assignedTeamId: item.assigned_team_id,
          assignedPlayerId: item.assigned_player_id,
        };
      }
    );

    // Smartest-first: the largest outstanding gaps rise to the top, bigger
    // requirements break ties, and fully-covered lines sink to the bottom.
    items.sort(
      (a, b) =>
        b.missing - a.missing ||
        b.required - a.required ||
        a.display_name.localeCompare(b.display_name)
    );

    const requiredTotal = items.reduce((sum, i) => sum + i.required, 0);
    const allocatedTotal = items.reduce((sum, i) => sum + i.allocated, 0);
    const missingTotal = items.reduce((sum, i) => sum + i.missing, 0);

    return {
      id: project.id,
      name: project.name,
      description: project.description,
      status: project.status,
      priority: project.priority,
      items,
      requiredTotal,
      allocatedTotal,
      missingTotal,
      completion: requiredTotal === 0 ? 1 : allocatedTotal / requiredTotal,
      satisfied: items.length > 0 && missingTotal === 0,
    };
  });
}

/** Sum unmet demand per item across active projects, largest gap first. */
export function aggregateShortfalls(projects: AllocatedProject[]): Shortfall[] {
  const byItem = new Map<string, Shortfall>();
  for (const project of projects) {
    if (project.status !== "active") continue;
    for (const item of project.items) {
      if (item.missing <= 0) continue;
      const existing = byItem.get(item.item_id);
      if (existing) {
        existing.missing += item.missing;
      } else {
        byItem.set(item.item_id, {
          item_id: item.item_id,
          display_name: item.display_name,
          missing: item.missing,
        });
      }
    }
  }
  return [...byItem.values()].sort((a, b) => b.missing - a.missing);
}

function serverId(): string | null {
  return process.env.QMSYNC_SERVER_ID?.trim() || null;
}

async function loadPool(): Promise<Map<string, number>> {
  const { data, error } = await getSupabase().rpc("get_available_inventory", {
    p_server_id: serverId(),
  });
  if (error) {
    // The inventory tables may not exist yet; planning still works against an
    // empty pool (everything shows as missing) rather than failing outright.
    console.error("Available-inventory lookup failed:", error);
    return new Map();
  }
  const pool = new Map<string, number>();
  for (const row of (data as PoolRow[] | null) ?? []) {
    pool.set(row.item_id, count(row.available));
  }
  return pool;
}

const EMPTY_OVERVIEW: BuildOverview = {
  ready: false,
  receiverConfigured: false,
  projects: [],
  shortfalls: [],
};

/** Everything the dashboard and detail pages need, allocated as one system. */
export async function getBuildOverview(): Promise<BuildOverview> {
  const receiverConfigured = Boolean(serverId());
  try {
    const supabase = getSupabase();
    const [projectsRes, itemsRes] = await Promise.all([
      supabase
        .from("build_projects")
        .select("*")
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true })
        .returns<BuildProject[]>(),
      supabase
        .from("build_project_items")
        .select("*")
        .order("created_at", { ascending: true })
        .returns<BuildProjectItem[]>(),
    ]);

    if (projectsRes.error || itemsRes.error) {
      console.error(
        "Build planner query failed:",
        projectsRes.error ?? itemsRes.error
      );
      return { ...EMPTY_OVERVIEW, receiverConfigured };
    }

    const pool = await loadPool();
    const itemsByProject = new Map<string, BuildProjectItem[]>();
    for (const item of itemsRes.data ?? []) {
      const list = itemsByProject.get(item.project_id);
      if (list) list.push(item);
      else itemsByProject.set(item.project_id, [item]);
    }

    const projects = allocateBuilds(projectsRes.data ?? [], itemsByProject, pool);
    return {
      ready: true,
      receiverConfigured,
      projects,
      shortfalls: aggregateShortfalls(projects),
    };
  } catch (error) {
    console.error("Build planner unavailable:", error);
    return { ...EMPTY_OVERVIEW, receiverConfigured };
  }
}

/** One allocated project by id (from the shared allocation), or null. */
export async function getBuildProject(
  id: string
): Promise<{ ready: boolean; project: AllocatedProject | null }> {
  const overview = await getBuildOverview();
  if (!overview.ready) return { ready: false, project: null };
  return {
    ready: true,
    project: overview.projects.find((p) => p.id === id) ?? null,
  };
}

/** The public download URL for a stored schematic object. */
export function buildFileUrl(storagePath: string): string {
  return getSupabase().storage.from(BUILD_FILES_BUCKET).getPublicUrl(storagePath).data
    .publicUrl;
}

/** Uploaded schematic files for one project, newest first. Empty on any error. */
export async function getBuildFiles(projectId: string): Promise<BuildFile[]> {
  const { data, error } = await getSupabase()
    .from("build_project_files")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .returns<BuildFile[]>();
  if (error) {
    // Table may not exist until 014 is run - downloads simply don't appear.
    console.error("getBuildFiles failed:", error);
    return [];
  }
  return data ?? [];
}

/** Label lookups for resolving assignee ids to names on the project pages. */
export interface AssigneeDirectory {
  teams: Map<string, { name: string; color: string | null }>;
  players: Map<string, string>;
}

/** Teams and active players, for turning assignee ids into readable names. */
export async function getAssigneeDirectory(): Promise<AssigneeDirectory> {
  const supabase = getSupabase();
  const [teamsRes, playersRes] = await Promise.all([
    supabase.from("teams").select("id, name, color").returns<
      { id: string; name: string; color: string | null }[]
    >(),
    supabase
      .from("players")
      .select("id, minecraft_ign")
      .eq("status", "active")
      .returns<{ id: string; minecraft_ign: string }[]>(),
  ]);

  const teams = new Map<string, { name: string; color: string | null }>();
  for (const t of teamsRes.data ?? []) teams.set(t.id, { name: t.name, color: t.color });
  const players = new Map<string, string>();
  for (const p of playersRes.data ?? []) players.set(p.id, p.minecraft_ign);
  return { teams, players };
}
