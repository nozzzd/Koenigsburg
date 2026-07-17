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

/** Empty form inputs should store as NULL, not "". */
function optional(value: FormDataEntryValue | null): string | null {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
}

function readFields(formData: FormData) {
  return {
    title: String(formData.get("title") ?? "").trim(),
    summary: optional(formData.get("summary")),
    body: String(formData.get("body") ?? "").trim(),
    image_url: optional(formData.get("image_url")),
    author: optional(formData.get("author")),
    pinned: formData.get("pinned") === "on",
  };
}

function validate(fields: ReturnType<typeof readFields>): string | null {
  if (fields.title.length < 2 || fields.title.length > 160) {
    return "Give the dispatch a title (2–160 characters).";
  }
  if (fields.body.length < 2) return "Write the body of the dispatch.";
  if (fields.image_url && !/^https?:\/\//i.test(fields.image_url)) {
    return "The image link must start with http:// or https://";
  }
  return null;
}

function refresh(id?: string) {
  revalidatePath("/portal");
  revalidatePath("/portal/news");
  revalidatePath("/portal/admin/news");
  if (id) revalidatePath(`/portal/news/${id}`);
}

export async function createNews(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const admin = await requireAdmin();
  const fields = readFields(formData);
  const invalid = validate(fields);
  if (invalid) return { error: invalid };

  const { error } = await getSupabase()
    .from("news")
    .insert({ ...fields, author: fields.author ?? admin.minecraft_ign });
  if (error) {
    console.error("createNews failed:", error);
    return { error: "Could not post the dispatch. Please try again." };
  }
  refresh();
  return null;
}

export async function updateNews(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  await requireAdmin();
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Missing dispatch id." };

  const fields = readFields(formData);
  const invalid = validate(fields);
  if (invalid) return { error: invalid };

  const { error } = await getSupabase().from("news").update(fields).eq("id", id);
  if (error) {
    console.error("updateNews failed:", error);
    return { error: "Could not update the dispatch. Please try again." };
  }
  refresh(id);
  return null;
}

export async function deleteNews(id: string): Promise<void> {
  await requireAdmin();
  const { error } = await getSupabase().from("news").delete().eq("id", id);
  if (error) throw new Error(`Could not delete the dispatch: ${error.message}`);
  refresh(id);
}
