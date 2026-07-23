"use server";

import { revalidatePath } from "next/cache";
import { getSupabase, type Player } from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import type {
  AtlasClaim,
  AtlasLayer,
  AtlasLayerKind,
  AtlasMarker,
  ClaimPoint,
  MarkerIconKind,
} from "@/lib/atlas";

export type AtlasResult<T> = { data: T } | { error: string };

const MAX_COORD = 30_000_000; // world border
const MAX_NAME = 60;
const MAX_LABEL = 80;
const MAX_ICON = 160;
const MAX_POINTS = 200;

function isAdmin(player: Player): boolean {
  return player.role === "admin" && player.status === "active";
}

async function requireAdmin(): Promise<Player> {
  const me = await getSessionPlayer();
  if (!me || !isAdmin(me)) throw new Error("Not authorized");
  return me;
}

function refresh() {
  revalidatePath("/map");
}

function clampCoord(n: unknown): number | null {
  const v = Number(n);
  if (!Number.isFinite(v)) return null;
  return Math.max(-MAX_COORD, Math.min(MAX_COORD, Math.round(v)));
}

function cleanColor(raw: unknown): string {
  const s = String(raw ?? "").trim();
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.toLowerCase() : "#22c55e";
}

function cleanPoints(raw: unknown): ClaimPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: ClaimPoint[] = [];
  for (const p of raw) {
    if (out.length >= MAX_POINTS) break;
    if (Array.isArray(p) && p.length >= 2) {
      const x = clampCoord(p[0]);
      const z = clampCoord(p[1]);
      if (x !== null && z !== null) out.push([x, z]);
    }
  }
  return out;
}

// ---- Layers ---------------------------------------------------------------

export async function createLayer(input: {
  kind: AtlasLayerKind;
  name: string;
  color: string;
  secret?: boolean;
}): Promise<AtlasResult<AtlasLayer>> {
  await requireAdmin();
  const name = String(input.name ?? "").trim().slice(0, MAX_NAME);
  if (!name) return { error: "Name the layer first." };
  const kind: AtlasLayerKind = input.kind === "country" ? "country" : "group";

  const { data, error } = await getSupabase()
    .from("map_layers")
    .insert({
      kind,
      name,
      color: cleanColor(input.color),
      secret: !!input.secret,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("createLayer failed:", error);
    return { error: "Could not create that layer. Is migration 015 run?" };
  }
  refresh();
  return {
    data: {
      id: data.id,
      kind: data.kind === "country" ? "country" : "group",
      name: data.name,
      color: data.color,
      secret: !!data.secret,
      visibleDefault: !!data.visible_default,
      sortOrder: data.sort_order ?? 0,
    },
  };
}

export async function updateLayer(
  id: string,
  patch: { name?: string; color?: string; secret?: boolean }
): Promise<AtlasResult<{ id: string }>> {
  await requireAdmin();
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) {
    const n = patch.name.trim().slice(0, MAX_NAME);
    if (!n) return { error: "Name can't be empty." };
    row.name = n;
  }
  if (patch.color !== undefined) row.color = cleanColor(patch.color);
  if (patch.secret !== undefined) row.secret = !!patch.secret;
  if (Object.keys(row).length === 0) return { data: { id } };

  const { error } = await getSupabase().from("map_layers").update(row).eq("id", id);
  if (error) {
    console.error("updateLayer failed:", error);
    return { error: "Could not save that change." };
  }
  refresh();
  return { data: { id } };
}

export async function deleteLayer(id: string): Promise<AtlasResult<{ id: string }>> {
  await requireAdmin();
  const { error } = await getSupabase().from("map_layers").delete().eq("id", id);
  if (error) {
    console.error("deleteLayer failed:", error);
    return { error: "Could not delete that layer." };
  }
  refresh();
  return { data: { id } };
}

// ---- Markers --------------------------------------------------------------

export async function createMarker(input: {
  layerId: string;
  label: string;
  iconKind: MarkerIconKind;
  icon: string;
  x: number;
  z: number;
  showLabel?: boolean;
  showIcon?: boolean;
  secret?: boolean;
}): Promise<AtlasResult<AtlasMarker>> {
  await requireAdmin();
  if (!input.layerId) return { error: "Pick a layer for the marker." };
  const x = clampCoord(input.x);
  const z = clampCoord(input.z);
  if (x === null || z === null) return { error: "Invalid coordinates." };
  const iconKind: MarkerIconKind =
    input.iconKind === "symbol" || input.iconKind === "item" ? input.iconKind : "waypoint";

  const { data, error } = await getSupabase()
    .from("map_markers")
    .insert({
      layer_id: input.layerId,
      label: String(input.label ?? "").slice(0, MAX_LABEL),
      icon_kind: iconKind,
      icon: String(input.icon ?? "").slice(0, MAX_ICON),
      x,
      z,
      show_label: input.showLabel ?? true,
      show_icon: input.showIcon ?? true,
      secret: !!input.secret,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("createMarker failed:", error);
    return { error: "Could not place that marker." };
  }
  refresh();
  return {
    data: {
      id: data.id,
      layerId: data.layer_id,
      label: data.label ?? "",
      iconKind: (data.icon_kind ?? "waypoint") as MarkerIconKind,
      icon: data.icon ?? "",
      x: data.x,
      z: data.z,
      showLabel: !!data.show_label,
      showIcon: !!data.show_icon,
      secret: !!data.secret,
    },
  };
}

export async function updateMarker(
  id: string,
  patch: Partial<{
    layerId: string;
    label: string;
    iconKind: MarkerIconKind;
    icon: string;
    x: number;
    z: number;
    showLabel: boolean;
    showIcon: boolean;
    secret: boolean;
  }>
): Promise<AtlasResult<{ id: string }>> {
  await requireAdmin();
  const row: Record<string, unknown> = {};
  if (patch.layerId !== undefined) row.layer_id = patch.layerId;
  if (patch.label !== undefined) row.label = patch.label.slice(0, MAX_LABEL);
  if (patch.iconKind !== undefined) row.icon_kind = patch.iconKind;
  if (patch.icon !== undefined) row.icon = patch.icon.slice(0, MAX_ICON);
  if (patch.x !== undefined) {
    const x = clampCoord(patch.x);
    if (x === null) return { error: "Invalid X." };
    row.x = x;
  }
  if (patch.z !== undefined) {
    const z = clampCoord(patch.z);
    if (z === null) return { error: "Invalid Z." };
    row.z = z;
  }
  if (patch.showLabel !== undefined) row.show_label = patch.showLabel;
  if (patch.showIcon !== undefined) row.show_icon = patch.showIcon;
  if (patch.secret !== undefined) row.secret = patch.secret;
  if (Object.keys(row).length === 0) return { data: { id } };

  const { error } = await getSupabase().from("map_markers").update(row).eq("id", id);
  if (error) {
    console.error("updateMarker failed:", error);
    return { error: "Could not save that marker." };
  }
  refresh();
  return { data: { id } };
}

export async function deleteMarker(id: string): Promise<AtlasResult<{ id: string }>> {
  await requireAdmin();
  const { error } = await getSupabase().from("map_markers").delete().eq("id", id);
  if (error) {
    console.error("deleteMarker failed:", error);
    return { error: "Could not delete that marker." };
  }
  refresh();
  return { data: { id } };
}

// ---- Claims ---------------------------------------------------------------

export async function createClaim(input: {
  layerId: string;
  name?: string;
  points: ClaimPoint[];
  secret?: boolean;
}): Promise<AtlasResult<AtlasClaim>> {
  await requireAdmin();
  if (!input.layerId) return { error: "Pick a layer for the claim." };
  const points = cleanPoints(input.points);
  if (points.length < 3) return { error: "A claim needs at least three points." };

  const { data, error } = await getSupabase()
    .from("map_claims")
    .insert({
      layer_id: input.layerId,
      name: String(input.name ?? "").slice(0, MAX_LABEL),
      points,
      secret: !!input.secret,
    })
    .select("*")
    .single();
  if (error || !data) {
    console.error("createClaim failed:", error);
    return { error: "Could not save that claim." };
  }
  refresh();
  return {
    data: {
      id: data.id,
      layerId: data.layer_id,
      name: data.name ?? "",
      points: cleanPoints(data.points),
      secret: !!data.secret,
    },
  };
}

export async function updateClaim(
  id: string,
  patch: Partial<{ name: string; points: ClaimPoint[]; secret: boolean; layerId: string }>
): Promise<AtlasResult<{ id: string }>> {
  await requireAdmin();
  const row: Record<string, unknown> = {};
  if (patch.layerId !== undefined) row.layer_id = patch.layerId;
  if (patch.name !== undefined) row.name = patch.name.slice(0, MAX_LABEL);
  if (patch.secret !== undefined) row.secret = patch.secret;
  if (patch.points !== undefined) {
    const points = cleanPoints(patch.points);
    if (points.length < 3) return { error: "A claim needs at least three points." };
    row.points = points;
  }
  if (Object.keys(row).length === 0) return { data: { id } };

  const { error } = await getSupabase().from("map_claims").update(row).eq("id", id);
  if (error) {
    console.error("updateClaim failed:", error);
    return { error: "Could not save that claim." };
  }
  refresh();
  return { data: { id } };
}

export async function deleteClaim(id: string): Promise<AtlasResult<{ id: string }>> {
  await requireAdmin();
  const { error } = await getSupabase().from("map_claims").delete().eq("id", id);
  if (error) {
    console.error("deleteClaim failed:", error);
    return { error: "Could not delete that claim." };
  }
  refresh();
  return { data: { id } };
}
