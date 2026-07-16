import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

export type PlayerStatus = "pending" | "active";
export type PlayerRole = "guest" | "citizen" | "admin";

export interface Player {
  id: string;
  minecraft_ign: string;
  discord_id: string | null;
  discord_username: string;
  verification_code: string;
  status: PlayerStatus;
  role: PlayerRole;
  created_at: string;
}

let client: SupabaseClient | null = null;

/**
 * Service-role client — server only, bypasses RLS. Never expose to the browser
 * (the `server-only` import above makes bundling it client-side a build error).
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
