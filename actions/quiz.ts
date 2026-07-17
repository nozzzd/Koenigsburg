"use server";

import { cache } from "react";
import { revalidatePath } from "next/cache";
import { getSupabase, type QuizRoleMap } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import { ARCHETYPES, type ArchetypeKey } from "@/lib/quiz";

const VALID_ARCHETYPES = new Set<string>(ARCHETYPES.map((a) => a.key));

async function requireAdmin() {
  const me = await getSessionPlayer();
  if (!me || me.role !== "admin" || me.status !== "active") {
    throw new Error("Not authorized");
  }
  return me;
}

/**
 * The current archetype -> team_id mapping, deduped per request. Returns an
 * empty map if the quiz_role_map table doesn't exist yet (unmigrated) so the
 * quiz and signup degrade gracefully rather than crashing.
 */
export const getRoleMap = cache(async (): Promise<Record<ArchetypeKey, string>> => {
  const { data, error } = await getSupabase()
    .from("quiz_role_map")
    .select("archetype, team_id")
    .returns<Pick<QuizRoleMap, "archetype" | "team_id">[]>();

  if (error) return {} as Record<ArchetypeKey, string>;

  const map = {} as Record<ArchetypeKey, string>;
  for (const row of data ?? []) {
    if (VALID_ARCHETYPES.has(row.archetype)) {
      map[row.archetype as ArchetypeKey] = row.team_id;
    }
  }
  return map;
});

/** The archetypes an admin has wired to a team — what the quiz needs to know. */
export async function getMappedRoles(): Promise<ArchetypeKey[]> {
  return Object.keys(await getRoleMap()) as ArchetypeKey[];
}

/**
 * Resolve one archetype key to its mapped team id, or null. Used server-side to
 * validate the quiz -> signup handoff so a client can never inject a team id.
 */
export async function resolveRoleTeam(archetype: string): Promise<string | null> {
  if (!VALID_ARCHETYPES.has(archetype)) return null;
  const map = await getRoleMap();
  return map[archetype as ArchetypeKey] ?? null;
}

/** Admin: map an archetype to a team, or clear it (teamId === null). */
export async function setRoleMapping(
  archetype: string,
  teamId: string | null
): Promise<void> {
  await requireAdmin();
  if (!VALID_ARCHETYPES.has(archetype)) throw new Error("Unknown archetype");

  const supabase = getSupabase();
  if (!teamId) {
    const { error } = await supabase.from("quiz_role_map").delete().eq("archetype", archetype);
    if (error) throw new Error(`Could not clear the mapping: ${error.message}`);
  } else {
    const { error } = await supabase
      .from("quiz_role_map")
      .upsert(
        { archetype, team_id: teamId, updated_at: new Date().toISOString() },
        { onConflict: "archetype" }
      );
    if (error) throw new Error(`Could not save the mapping: ${error.message}`);
  }

  revalidatePath("/portal/admin/quiz");
  revalidatePath("/quiz");
  revalidatePath("/apply");
}
