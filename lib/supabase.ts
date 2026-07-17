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
  /**
   * Pre-approval: the public signup code, posted in #immigration to prove
   * ownership. On approval it is rotated, so the posted value dies and this
   * becomes the member's PRIVATE login key. Never display it publicly.
   */
  verification_code: string;
  status: PlayerStatus;
  role: PlayerRole;
  /** False until they confirm they've written down their login key. */
  key_saved: boolean;
  created_at: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  image_url: string | null;
  builder: string | null;
  tag: string | null;
  sort_order: number;
  created_at: string;
}

export type TaskScope = "personal" | "assigned" | "realm";

export interface Task {
  id: string;
  title: string;
  scope: TaskScope;
  /** Whose list it sits on; null for realm-wide goals. */
  player_id: string | null;
  assigned_by: string | null;
  done: boolean;
  created_at: string;
}

export interface NewsPost {
  id: string;
  title: string;
  summary: string | null;
  body: string;
  image_url: string | null;
  author: string | null;
  pinned: boolean;
  created_at: string;
}

let client: SupabaseClient | null = null;

/**
 * Normalize the project URL to just the origin. supabase-js appends
 * `/rest/v1/...` itself, so a value pasted with a trailing slash or a
 * `/rest/v1` suffix must be stripped or every request 404s ("Invalid path").
 */
function normalizeSupabaseUrl(raw: string): string {
  return raw
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/rest\/v1$/, "")
    .replace(/\/+$/, "");
}

/**
 * Service-role client — server only, bypasses RLS. Never expose to the browser
 * (the `server-only` import above makes bundling it client-side a build error).
 */
export function getSupabase(): SupabaseClient {
  if (!client) {
    client = createClient(
      normalizeSupabaseUrl(env("SUPABASE_URL")),
      env("SUPABASE_SERVICE_ROLE_KEY"),
      {
        auth: { persistSession: false, autoRefreshToken: false },
      }
    );
  }
  return client;
}
