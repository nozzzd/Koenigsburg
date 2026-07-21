import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

export type PlayerStatus = "pending" | "active";
export type PlayerRole = "guest" | "citizen" | "admin";

export interface Player {
  id: string;
  minecraft_ign: string;
  /** Stable Mojang identity, linked by the first approved QMSync upload. */
  minecraft_uuid: string | null;
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
  /**
   * Team a pending recruit elected via the alignment quiz. Applied and cleared
   * on approval; NULL for normal signups.
   */
  pending_team_id: string | null;
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

export type TaskScope = "personal" | "assigned" | "realm" | "team";

export interface Task {
  id: string;
  title: string;
  scope: TaskScope;
  /** Whose list it sits on; null for realm-wide and team goals. */
  player_id: string | null;
  /** Set for team tasks — the task shows on every member of this team. */
  team_id: string | null;
  assigned_by: string | null;
  done: boolean;
  created_at: string;
}

export interface Team {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  /** NULL for website-only teams. */
  discord_role_id: string | null;
  /** True if citizens may join/leave this team themselves from the portal. */
  self_assignable: boolean;
  created_at: string;
}

export interface TeamMember {
  team_id: string;
  player_id: string;
  joined_at: string;
}

/** Admin-set mapping of a quiz archetype (e.g. "builder") to a real team. */
export interface QuizRoleMap {
  archetype: string;
  team_id: string;
  updated_at: string;
}

export type FunnelEventName =
  | "landing_view"
  | "quiz_start"
  | "quiz_finish"
  | "quiz_share"
  | "signup_view"
  | "discord_click";

/** One anonymous recruitment-funnel step. visit_id is a token, not a person. */
export interface FunnelEvent {
  id: string;
  event: FunnelEventName;
  visit_id: string;
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

/** Public-read Storage bucket holding the community map's region tiles. */
export const MAP_TILES_BUCKET = "map-tiles";

export type MapDimension = "overworld" | "nether" | "end";

/**
 * One 512x512-block region of the crowd-sourced world map. `region_x`/`region_z`
 * are Xaero region coordinates (block coord / 512, floored); the tile image lives
 * in the `map-tiles` bucket at `storage_path`. Unique per (dimension, x, z);
 * `captured_at` (the region file's own modification time) is the merge key — a
 * tile is only replaced by one with a NEWER capture date.
 */
export interface MapTile {
  id: string;
  dimension: MapDimension;
  region_x: number;
  region_z: number;
  storage_path: string;
  contributor_player_id: string | null;
  contributor_ign: string | null;
  captured_at: string;
  uploaded_at: string;
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
