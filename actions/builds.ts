"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase, type Player } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import type { ActionState } from "@/lib/forms";
import type { BuildStatus } from "@/lib/builds";
import { parseMaterialList, slugToItemId } from "@/lib/litematica";

const MAX_NAME = 120;
const MAX_ITEM_ID = 160;
const MAX_DISPLAY = 120;
const MAX_QTY = 1_000_000_000;
const STATUSES: readonly BuildStatus[] = ["active", "archived", "completed"];

function isAdmin(player: Player): boolean {
  return player.role === "admin" && player.status === "active";
}

async function requireAdmin(): Promise<Player> {
  const me = await getSessionPlayer();
  if (!me || !isAdmin(me)) throw new Error("Not authorized");
  return me;
}

/** Refresh the dashboard and, when given, one project's detail page. */
function refresh(projectId?: string) {
  revalidatePath("/portal/admin/builds");
  if (projectId) revalidatePath(`/portal/admin/builds/${projectId}`);
}

function str(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** A positive integer within bounds, or null when blank/invalid. */
function posInt(raw: string, max = MAX_QTY): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[,\s]/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(Math.trunc(n), max);
}

/** A non-negative integer (0 allowed) within bounds, or null when blank. */
function nonNegInt(raw: string, max = MAX_QTY): number | null {
  if (!raw) return null;
  const n = Number(raw.replace(/[,\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(Math.trunc(n), max);
}

/** Found a new build project. */
export async function createBuildProject(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await requireAdmin();

  const name = str(formData, "name");
  const description = str(formData, "description");
  const priority = posInt(str(formData, "priority"), 100_000);

  if (name.length < 2) return { error: "Give the project a name first." };
  if (name.length > MAX_NAME) return { error: `Keep the name under ${MAX_NAME} characters.` };

  const { error } = await getSupabase().from("build_projects").insert({
    name,
    description: description || null,
    priority: priority ?? 0,
    created_by: me.id,
  });
  if (error) {
    console.error("createBuildProject failed:", error);
    return { error: "Could not create that project. Please try again." };
  }
  refresh();
  return null;
}

/** Rename / re-describe / re-prioritise an existing project. */
export async function updateBuildProject(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const id = str(formData, "project_id");
  const name = str(formData, "name");
  const description = str(formData, "description");
  const priority = posInt(str(formData, "priority"), 100_000);
  if (!id) return { error: "Missing project." };
  if (name.length < 2) return { error: "Give the project a name first." };
  if (name.length > MAX_NAME) return { error: `Keep the name under ${MAX_NAME} characters.` };

  const { error } = await getSupabase()
    .from("build_projects")
    .update({
      name,
      description: description || null,
      priority: priority ?? 0,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) {
    console.error("updateBuildProject failed:", error);
    return { error: "Could not save those changes. Please try again." };
  }
  refresh(id);
  return null;
}

/** Move a project between active / archived / completed. */
export async function setBuildStatus(id: string, status: BuildStatus): Promise<void> {
  await requireAdmin();
  if (!STATUSES.includes(status)) throw new Error("Unknown status");

  const { error } = await getSupabase()
    .from("build_projects")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`Could not change the status: ${error.message}`);
  refresh(id);
}

/** Delete a project and, by cascade, all its requirements, then return to the plan. */
export async function deleteBuildProject(id: string): Promise<void> {
  await requireAdmin();
  const { error } = await getSupabase().from("build_projects").delete().eq("id", id);
  if (error) throw new Error(`Could not remove the project: ${error.message}`);
  refresh();
  redirect("/portal/admin/builds");
}

/** Add one requirement line to a project. */
export async function addBuildItem(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const projectId = str(formData, "project_id");
  const displayInput = str(formData, "display_name");
  const idInput = str(formData, "item_id");
  const quantity = posInt(str(formData, "required_quantity"));

  if (!projectId) return { error: "Missing project." };
  if (displayInput.length < 1 && idInput.length < 1) {
    return { error: "Name the item first." };
  }
  if (!quantity) return { error: "Enter how many are needed." };

  const display_name = (displayInput || idInput).slice(0, MAX_DISPLAY);
  const item_id = (idInput || slugToItemId(displayInput)).toLowerCase().slice(0, MAX_ITEM_ID);

  const { error } = await getSupabase()
    .from("build_project_items")
    .upsert(
      {
        project_id: projectId,
        item_id,
        display_name,
        required_quantity: quantity,
      },
      { onConflict: "project_id,item_id" }
    );
  if (error) {
    console.error("addBuildItem failed:", error);
    return { error: "Could not add that item. Please try again." };
  }
  refresh(projectId);
  return null;
}

/** Edit a requirement's target and its manual reservation override. */
export async function updateBuildItem(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const itemRowId = str(formData, "item_row_id");
  const projectId = str(formData, "project_id");
  const quantity = posInt(str(formData, "required_quantity"));
  const overrideRaw = str(formData, "manual_override");
  const override = overrideRaw ? nonNegInt(overrideRaw) : null;

  if (!itemRowId) return { error: "Missing item." };
  if (!quantity) return { error: "The required amount must be a positive number." };
  if (overrideRaw && override === null) {
    return { error: "The override must be zero or a positive number." };
  }

  const { error } = await getSupabase()
    .from("build_project_items")
    .update({ required_quantity: quantity, manual_override: override })
    .eq("id", itemRowId);
  if (error) {
    console.error("updateBuildItem failed:", error);
    return { error: "Could not save that line. Please try again." };
  }
  refresh(projectId || undefined);
  return null;
}

/** Toggle whether a line claims its share of the pool before unlocked lines. */
export async function toggleBuildItemLock(
  itemRowId: string,
  projectId: string,
  next: boolean
): Promise<void> {
  await requireAdmin();
  const { error } = await getSupabase()
    .from("build_project_items")
    .update({ locked: next })
    .eq("id", itemRowId);
  if (error) throw new Error(`Could not change the lock: ${error.message}`);
  refresh(projectId);
}

/** Remove one requirement line. */
export async function removeBuildItem(itemRowId: string, projectId: string): Promise<void> {
  await requireAdmin();
  const { error } = await getSupabase()
    .from("build_project_items")
    .delete()
    .eq("id", itemRowId);
  if (error) throw new Error(`Could not remove that item: ${error.message}`);
  refresh(projectId);
}

/**
 * Import a pasted material list (Litematica or free-form) into a project.
 * Each parsed line upserts on (project_id, item_id), so re-importing an updated
 * list simply refreshes the target amounts rather than duplicating rows.
 */
export async function importMaterials(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const projectId = str(formData, "project_id");
  const raw = String(formData.get("materials") ?? "");
  if (!projectId) return { error: "Missing project." };
  if (!raw.trim()) return { error: "Paste a material list first." };

  const parsed = parseMaterialList(raw);
  if (parsed.length === 0) {
    return { error: "Couldn't read any items from that. Check the format and try again." };
  }

  const rows = parsed.map((m) => ({
    project_id: projectId,
    item_id: m.item_id.toLowerCase().slice(0, MAX_ITEM_ID),
    display_name: m.display_name.slice(0, MAX_DISPLAY),
    required_quantity: Math.min(m.quantity, MAX_QTY),
  }));

  const { error } = await getSupabase()
    .from("build_project_items")
    .upsert(rows, { onConflict: "project_id,item_id" });
  if (error) {
    console.error("importMaterials failed:", error);
    return { error: "Could not import that list. Please try again." };
  }
  refresh(projectId);
  return null;
}
