"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase, BUILD_FILES_BUCKET, type Player } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import type { ActionState } from "@/lib/forms";
import type { BuildStatus } from "@/lib/builds";
import { parseMaterialList, slugToItemId } from "@/lib/litematica";

const MAX_FILE_BYTES = 25 * 1024 * 1024; // 25 MB
const ALLOWED_FILE_EXT = [".litematic", ".schem", ".schematic", ".nbt"];

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

/** Refresh the admin views, the citizen views, and one project's detail pages. */
function refresh(projectId?: string) {
  revalidatePath("/portal/admin/builds");
  revalidatePath("/portal/builds");
  revalidatePath("/portal");
  if (projectId) {
    revalidatePath(`/portal/admin/builds/${projectId}`);
    revalidatePath(`/portal/builds/${projectId}`);
  }
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

/**
 * Assign responsibility for a requirement to a team or a single player.
 * The `assignee` field is "team:<id>", "player:<id>", or empty to clear.
 * A team and a player are mutually exclusive.
 */
export async function setBuildItemAssignee(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();

  const itemRowId = str(formData, "item_row_id");
  const projectId = str(formData, "project_id");
  const assignee = str(formData, "assignee");
  if (!itemRowId) return { error: "Missing item." };

  let assigned_team_id: string | null = null;
  let assigned_player_id: string | null = null;
  if (assignee.startsWith("team:")) assigned_team_id = assignee.slice(5) || null;
  else if (assignee.startsWith("player:")) assigned_player_id = assignee.slice(7) || null;

  const { error } = await getSupabase()
    .from("build_project_items")
    .update({ assigned_team_id, assigned_player_id })
    .eq("id", itemRowId);
  if (error) {
    console.error("setBuildItemAssignee failed:", error);
    return { error: "Could not save that assignment. Please try again." };
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

function safeFileName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 200) || "schematic";
}

/** Upload a Litematica / schematic file to a project for citizens to download. */
export async function uploadBuildFile(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await requireAdmin();

  const projectId = str(formData, "project_id");
  const file = formData.get("file");
  if (!projectId) return { error: "Missing project." };
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file first." };
  if (file.size > MAX_FILE_BYTES) {
    return { error: "That file is too large (25 MB max)." };
  }

  const lower = file.name.toLowerCase();
  if (!ALLOWED_FILE_EXT.some((ext) => lower.endsWith(ext))) {
    return { error: `Only ${ALLOWED_FILE_EXT.join(", ")} files are allowed.` };
  }

  const fileName = safeFileName(file.name);
  const storagePath = `${projectId}/${crypto.randomUUID()}-${fileName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  const contentType = file.type || "application/octet-stream";

  const supabase = getSupabase();
  const { error: uploadError } = await supabase.storage
    .from(BUILD_FILES_BUCKET)
    .upload(storagePath, bytes, { upsert: false, contentType });
  if (uploadError) {
    console.error("uploadBuildFile storage failed:", uploadError);
    return {
      error:
        "Could not store that file. If the build-files bucket is missing, run supabase/014_build_assignees_and_files.sql.",
    };
  }

  const { error: rowError } = await supabase.from("build_project_files").insert({
    project_id: projectId,
    file_name: fileName,
    storage_path: storagePath,
    size_bytes: file.size,
    content_type: contentType,
    uploaded_by: me.id,
  });
  if (rowError) {
    console.error("uploadBuildFile row failed:", rowError);
    await supabase.storage.from(BUILD_FILES_BUCKET).remove([storagePath]);
    return { error: "Could not save that file. Please try again." };
  }

  refresh(projectId);
  return null;
}

/** Remove an uploaded schematic (storage object + metadata row). */
export async function deleteBuildFile(fileId: string, projectId: string): Promise<void> {
  await requireAdmin();
  const supabase = getSupabase();

  const { data } = await supabase
    .from("build_project_files")
    .select("storage_path")
    .eq("id", fileId)
    .maybeSingle<{ storage_path: string }>();

  const { error } = await supabase.from("build_project_files").delete().eq("id", fileId);
  if (error) throw new Error(`Could not remove that file: ${error.message}`);
  if (data?.storage_path) {
    await supabase.storage.from(BUILD_FILES_BUCKET).remove([data.storage_path]);
  }
  refresh(projectId);
}
