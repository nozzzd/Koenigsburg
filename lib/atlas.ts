import { getSupabase } from "@/lib/supabase";

/** One charted region tile, resolved to a public image URL, ready to render. */
export type DisplayTile = {
  rx: number;
  rz: number;
  url: string;
  ign: string | null;
};

export type AtlasLayerKind = "country" | "group";
export type MarkerIconKind = "waypoint" | "symbol" | "item";

export interface AtlasLayer {
  id: string;
  kind: AtlasLayerKind;
  name: string;
  color: string;
  secret: boolean;
  visibleDefault: boolean;
  sortOrder: number;
}

export interface AtlasMarker {
  id: string;
  layerId: string;
  label: string;
  iconKind: MarkerIconKind;
  icon: string;
  x: number;
  z: number;
  showLabel: boolean;
  showIcon: boolean;
  secret: boolean;
}

/** A polygon ring of [x, z] block coordinates. */
export type ClaimPoint = [number, number];

export interface AtlasClaim {
  id: string;
  layerId: string;
  name: string;
  points: ClaimPoint[];
  secret: boolean;
}

export interface Atlas {
  layers: AtlasLayer[];
  markers: AtlasMarker[];
  claims: AtlasClaim[];
}

const EMPTY: Atlas = { layers: [], markers: [], claims: [] };

interface LayerRow {
  id: string;
  kind: string;
  name: string;
  color: string;
  secret: boolean;
  visible_default: boolean;
  sort_order: number;
}
interface MarkerRow {
  id: string;
  layer_id: string;
  label: string;
  icon_kind: string;
  icon: string;
  x: number;
  z: number;
  show_label: boolean;
  show_icon: boolean;
  secret: boolean;
}
interface ClaimRow {
  id: string;
  layer_id: string;
  name: string;
  points: unknown;
  secret: boolean;
}

function toLayer(r: LayerRow): AtlasLayer {
  return {
    id: r.id,
    kind: r.kind === "country" ? "country" : "group",
    name: r.name,
    color: r.color,
    secret: !!r.secret,
    visibleDefault: !!r.visible_default,
    sortOrder: r.sort_order ?? 0,
  };
}

function toPoints(raw: unknown): ClaimPoint[] {
  if (!Array.isArray(raw)) return [];
  const out: ClaimPoint[] = [];
  for (const p of raw) {
    if (Array.isArray(p) && p.length >= 2) {
      const x = Number(p[0]);
      const z = Number(p[1]);
      if (Number.isFinite(x) && Number.isFinite(z)) out.push([Math.round(x), Math.round(z)]);
    }
  }
  return out;
}

/**
 * Loads the whole atlas. When `canSeeSecret` is false (a visitor who is not an
 * active citizen), every secret layer - and every marker/claim on a secret
 * layer or flagged secret itself - is removed HERE, on the server, so it is
 * never serialised into the page. Inspect-element and the network tab see
 * nothing. Active citizens (and admins) get everything.
 */
export async function getAtlas(canSeeSecret: boolean): Promise<Atlas> {
  const supabase = getSupabase();

  const [layersRes, markersRes, claimsRes] = await Promise.all([
    supabase.from("map_layers").select("*").order("sort_order").returns<LayerRow[]>(),
    supabase.from("map_markers").select("*").returns<MarkerRow[]>(),
    supabase.from("map_claims").select("*").returns<ClaimRow[]>(),
  ]);

  if (layersRes.error || markersRes.error || claimsRes.error) {
    // Migration 015 not run yet - degrade to an empty atlas rather than crash
    // the public map page.
    if (layersRes.error) console.error("map_layers load failed:", layersRes.error);
    return EMPTY;
  }

  const layers = (layersRes.data ?? []).map(toLayer);
  const secretLayerIds = new Set(layers.filter((l) => l.secret).map((l) => l.id));

  const markers: AtlasMarker[] = (markersRes.data ?? []).map((r) => ({
    id: r.id,
    layerId: r.layer_id,
    label: r.label ?? "",
    iconKind:
      r.icon_kind === "symbol" || r.icon_kind === "item" ? r.icon_kind : "waypoint",
    icon: r.icon ?? "",
    x: r.x,
    z: r.z,
    showLabel: !!r.show_label,
    showIcon: !!r.show_icon,
    secret: !!r.secret,
  }));

  const claims: AtlasClaim[] = (claimsRes.data ?? []).map((r) => ({
    id: r.id,
    layerId: r.layer_id,
    name: r.name ?? "",
    points: toPoints(r.points),
    secret: !!r.secret,
  }));

  if (canSeeSecret) return { layers, markers, claims };

  // Strip everything secret for outsiders.
  const visibleLayers = layers.filter((l) => !l.secret);
  const hidden = (layerId: string, ownSecret: boolean) =>
    ownSecret || secretLayerIds.has(layerId);
  return {
    layers: visibleLayers,
    markers: markers.filter((m) => !hidden(m.layerId, m.secret)),
    claims: claims.filter((c) => !hidden(c.layerId, c.secret)),
  };
}
