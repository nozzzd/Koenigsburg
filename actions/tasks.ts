"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase, type Player, type Task } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import type { ActionState } from "@/lib/forms";

const MAX_TITLE = 200;

function isAdmin(player: Player): boolean {
  return player.role === "admin" && player.status === "active";
}

async function requireAdmin(): Promise<Player> {
  const me = await getSessionPlayer();
  if (!me || !isAdmin(me)) throw new Error("Not authorized");
  return me;
}

async function loadTask(id: string): Promise<Task> {
  const { data } = await getSupabase()
    .from("tasks")
    .select("*")
    .eq("id", id)
    .maybeSingle<Task>();
  if (!data) throw new Error("Task not found");
  return data;
}

function readTitle(formData: FormData): string {
  return String(formData.get("title") ?? "").trim();
}

function refresh() {
  revalidatePath("/portal");
  revalidatePath("/portal/admin/tasks");
}

/** A member's own to-do. */
export async function addPersonalTask(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await getSessionPlayer();
  if (!me) redirect("/login");

  const title = readTitle(formData);
  if (title.length < 2) return { error: "Write out the task first." };
  if (title.length > MAX_TITLE) return { error: `Keep it under ${MAX_TITLE} characters.` };

  const { error } = await getSupabase().from("tasks").insert({
    title,
    scope: "personal",
    player_id: me.id,
  });
  if (error) {
    console.error("addPersonalTask failed:", error);
    return { error: "Could not add that. Please try again." };
  }
  refresh();
  return null;
}

/**
 * Tick a task off.
 *   personal / assigned → the member whose list it's on
 *   realm               → elders only
 */
export async function toggleTask(id: string): Promise<void> {
  const me = await getSessionPlayer();
  if (!me) redirect("/login");

  const task = await loadTask(id);
  const mine = task.player_id === me.id;
  const canToggle = mine || (task.scope === "realm" && isAdmin(me));
  if (!canToggle) throw new Error("Not authorized");

  const { error } = await getSupabase()
    .from("tasks")
    .update({ done: !task.done })
    .eq("id", task.id);
  if (error) throw new Error(`Could not update the task: ${error.message}`);
  refresh();
}

/**
 * Remove a task. A member may bin their own to-dos, but NOT one an elder set
 * for them — otherwise "assigned" would mean nothing.
 */
export async function deleteTask(id: string): Promise<void> {
  const me = await getSessionPlayer();
  if (!me) redirect("/login");

  const task = await loadTask(id);
  const ownPersonal = task.scope === "personal" && task.player_id === me.id;
  if (!ownPersonal && !isAdmin(me)) throw new Error("Not authorized");

  const { error } = await getSupabase().from("tasks").delete().eq("id", task.id);
  if (error) throw new Error(`Could not remove the task: ${error.message}`);
  refresh();
}

/** Elder sets a duty for one member. */
export async function assignTask(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await requireAdmin();

  const title = readTitle(formData);
  const playerId = String(formData.get("player_id") ?? "");
  if (!playerId) return { error: "Choose who it's for." };
  if (title.length < 2) return { error: "Write out the duty first." };
  if (title.length > MAX_TITLE) return { error: `Keep it under ${MAX_TITLE} characters.` };

  const { error } = await getSupabase().from("tasks").insert({
    title,
    scope: "assigned",
    player_id: playerId,
    assigned_by: me.id,
  });
  if (error) {
    console.error("assignTask failed:", error);
    return { error: "Could not assign that. Please try again." };
  }
  refresh();
  return null;
}

/**
 * A goal for the whole realm — every citizen sees it.
 *
 * EXTENDING THIS: once jobs exist (worker, mason…), a role-targeted goal is a
 * `target_role` column plus one more scope; nothing else here needs to change.
 */
export async function addRealmGoal(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const me = await requireAdmin();

  const title = readTitle(formData);
  if (title.length < 2) return { error: "Write out the goal first." };
  if (title.length > MAX_TITLE) return { error: `Keep it under ${MAX_TITLE} characters.` };

  const { error } = await getSupabase().from("tasks").insert({
    title,
    scope: "realm",
    player_id: null,
    assigned_by: me.id,
  });
  if (error) {
    console.error("addRealmGoal failed:", error);
    return { error: "Could not post the goal. Please try again." };
  }
  refresh();
  return null;
}
