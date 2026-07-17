"use server";

import { revalidatePath } from "next/cache";
import { getSupabase } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import type { ActionState } from "@/lib/forms";

async function requireAdmin() {
  const admin = await getSessionPlayer();
  if (!admin || admin.role !== "admin" || admin.status !== "active") {
    throw new Error("Not authorized");
  }
  return admin;
}

/** Empty strings from form inputs should be stored as NULL, not "". */
function optional(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function readFields(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageUrl = optional(formData.get("image_url"));
  return {
    title,
    description,
    image_url: imageUrl,
    builder: optional(formData.get("builder")),
    tag: optional(formData.get("tag")),
    sort_order: Number(formData.get("sort_order") ?? 0) || 0,
  };
}

function validate(fields: ReturnType<typeof readFields>): string | null {
  if (fields.title.length < 2 || fields.title.length > 120) {
    return "Give the work a title (2–120 characters).";
  }
  if (fields.description.length < 2) {
    return "Describe the work so visitors know what they're seeing.";
  }
  if (fields.image_url && !/^https?:\/\//i.test(fields.image_url)) {
    return "The image link must start with http:// or https://";
  }
  return null;
}

function refresh() {
  revalidatePath("/portal/admin/showcase");
  revalidatePath("/showcase");
}

export async function createProject(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const fields = readFields(formData);
  const invalid = validate(fields);
  if (invalid) return { error: invalid };

  const { error } = await getSupabase().from("projects").insert(fields);
  if (error) {
    console.error("createProject failed:", error);
    return { error: "Could not save the work. Please try again." };
  }
  refresh();
  return null;
}

export async function updateProject(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing project id." };

  const fields = readFields(formData);
  const invalid = validate(fields);
  if (invalid) return { error: invalid };

  const { error } = await getSupabase().from("projects").update(fields).eq("id", id);
  if (error) {
    console.error("updateProject failed:", error);
    return { error: "Could not update the work. Please try again." };
  }
  refresh();
  return null;
}

export async function deleteProject(id: string): Promise<void> {
  await requireAdmin();
  const { error } = await getSupabase().from("projects").delete().eq("id", id);
  if (error) throw new Error(`Could not delete the work: ${error.message}`);
  refresh();
}
