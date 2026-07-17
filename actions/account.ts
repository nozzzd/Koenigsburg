"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabase } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";

/** Dismisses the "save your login key" warning once they confirm they have it. */
export async function acknowledgeKey(): Promise<void> {
  const player = await getSessionPlayer();
  if (!player) redirect("/login");

  const { error } = await getSupabase()
    .from("players")
    .update({ key_saved: true })
    .eq("id", player.id);

  if (error) {
    // Most likely the key_saved column is missing (run supabase/003_login_key.sql).
    // Never crash the dashboard over a dismissable banner — log and move on.
    console.error(
      "acknowledgeKey failed (has supabase/003_login_key.sql been run?):",
      error
    );
  }

  revalidatePath("/portal");
  revalidatePath("/portal/settings");
}
