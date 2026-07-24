"use server";

import { revalidatePath } from "next/cache";
import {
  getSupabase,
  MAP_TILES_BUCKET,
  type MapDimension,
} from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";
import { checkRateLimit, ipFromHeaders } from "@/lib/ratelimit";
import { headers } from "next/headers";

/** Result of a tile-upload batch, reported back to the client uploader. */
export type SubmitTilesResult =
  | { error: string }
  | {
      /** Tiles written (new or fresher than what the map had). */
      ok: number;
      /** Tiles skipped because the map already holds newer scouting. */
      stale: number;
    };

const DIMENSIONS: MapDimension[] = ["overworld", "nether", "end"];
// The client renders regions to PNGs and uploads in small batches to stay
// under Vercel's ~4.5 MB body cap. Guard the batch size anyway.
const MAX_TILES_PER_BATCH = 16;
// A rendered 512x512 terrain PNG lands well under this.
const MAX_TILE_BYTES = 800 * 1024;
// World border is +/-30M blocks -> region coords fit comfortably in +/-60000.
const MAX_REGION_COORD = 60000;
// A capture date "from the future" would squat its region forever (no honest
// upload could ever beat it), so claims past the server clock get clamped.
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

type ExistingTile = {
  region_x: number;
  region_z: number;
  captured_at: string | null;
  storage_path: string;
};

type TileInput = {
  file: File;
  rx: number;
  rz: number;
  capturedMs: number;
};

function parseIntField(value: FormDataEntryValue | null): number | null {
  const n = Number(String(value ?? "").trim());
  return Number.isSafeInteger(n) ? n : null;
}

/** PNG signature + IHDR says 512x512 - cheap validity check, no image lib. */
function isRegionPng(bytes: Uint8Array): boolean {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24) return false;
  if (!signature.every((b, i) => bytes[i] === b)) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return view.getUint32(16) === 512 && view.getUint32(20) === 512;
}

/**
 * Stores one batch of rendered region tiles. Merge rule: a tile only replaces
 * the stored one if its capture date (the region file's modification time,
 * read client-side) is NEWER - so uploading a stale map can never wipe fresher
 * scouting. Session is re-checked here; the client is never trusted.
 */
export async function submitTiles(
  formData: FormData
): Promise<SubmitTilesResult> {
  const player = await getSessionPlayer();
  if (!player) return { error: "You must be logged in to contribute tiles." };
  if (player.status !== "active") {
    return {
      error: "Active citizenship is required to contribute map tiles.",
    };
  }

  // Bound how fast one contributor can overwrite tiles. Because "newest capture
  // wins" lets any citizen replace existing scouting, an unbounded uploader
  // could deface the whole map; this caps the blast radius per person and per
  // IP. Legit contribution (16 tiles/batch) has ample headroom.
  const ip = ipFromHeaders(await headers());
  const [byPlayer, byIp] = await Promise.all([
    checkRateLimit(`tiles:p:${player.id}`, 40, 10 * 60 * 1000),
    checkRateLimit(`tiles:ip:${ip}`, 40, 10 * 60 * 1000),
  ]);
  if (!byPlayer.ok || !byIp.ok) {
    return {
      error: "You're uploading tiles too quickly. Please wait a few minutes and try again.",
    };
  }

  const dimensionRaw = String(formData.get("dimension") ?? "overworld");
  const dimension = (DIMENSIONS.includes(dimensionRaw as MapDimension)
    ? dimensionRaw
    : "overworld") as MapDimension;

  const tiles = formData.getAll("tile").filter((t): t is File => t instanceof File);
  const xs = formData.getAll("rx");
  const zs = formData.getAll("rz");
  const capturedAts = formData.getAll("capturedAt");

  if (tiles.length === 0) return { error: "No tiles were received." };
  if (
    tiles.length !== xs.length ||
    tiles.length !== zs.length ||
    tiles.length !== capturedAts.length
  ) {
    return { error: "Malformed upload - field counts don't match." };
  }
  if (tiles.length > MAX_TILES_PER_BATCH) {
    return { error: "Too many tiles in one batch." };
  }

  const now = Date.now();
  const inputs: TileInput[] = [];
  for (let i = 0; i < tiles.length; i++) {
    const rx = parseIntField(xs[i]);
    const rz = parseIntField(zs[i]);
    const claimedMs = parseIntField(capturedAts[i]);
    if (
      rx === null ||
      rz === null ||
      claimedMs === null ||
      claimedMs <= 0 ||
      Math.abs(rx) > MAX_REGION_COORD ||
      Math.abs(rz) > MAX_REGION_COORD
    ) {
      continue;
    }
    inputs.push({
      file: tiles[i],
      rx,
      rz,
      capturedMs: Math.min(claimedMs, now + MAX_CLOCK_SKEW_MS),
    });
  }

  if (inputs.length === 0) {
    return { error: "None of the tiles had valid coordinates or capture dates." };
  }

  const supabase = getSupabase();

  // One query for everything this batch might replace. (.in() is a superset
  // cross-product of the batch coords; exact pairs are matched below.)
  const { data: existingRows, error: existingError } = await supabase
    .from("map_tiles")
    .select("region_x, region_z, captured_at, storage_path")
    .eq("dimension", dimension)
    .in("region_x", [...new Set(inputs.map((t) => t.rx))])
    .in("region_z", [...new Set(inputs.map((t) => t.rz))])
    .returns<ExistingTile[]>();
  if (existingError) {
    console.error("map_tiles lookup failed:", existingError);
    return {
      error:
        "The map storage isn't reachable. If the map_tiles table is missing, run supabase/010_map_tiles.sql.",
    };
  }
  const existingByCell = new Map<string, { capturedMs: number; path: string }>(
    (existingRows ?? []).map((row) => [
      `${row.region_x}_${row.region_z}`,
      {
        capturedMs: row.captured_at ? Date.parse(row.captured_at) : 0,
        path: row.storage_path,
      },
    ])
  );

  let ok = 0;
  let stale = 0;

  for (const tile of inputs) {
    // Newest wins: never let older scouting overwrite fresher data. A tie is
    // the same file re-uploaded, so it is skipped too.
    const cellKey = `${tile.rx}_${tile.rz}`;
    const stored = existingByCell.get(cellKey);
    if (stored !== undefined && stored.capturedMs >= tile.capturedMs) {
      stale++;
      continue;
    }

    if (tile.file.size > MAX_TILE_BYTES) continue;
    const bytes = new Uint8Array(await tile.file.arrayBuffer());
    if (!isRegionPng(bytes)) continue;

    // Upload to a unique object first. The database row is the public pointer,
    // so a rejected stale tile can never overwrite the live image object.
    const path = `${dimension}/incoming/${player.id}/${crypto.randomUUID()}.png`;
    const capturedAt = new Date(tile.capturedMs).toISOString();
    const uploadedAt = new Date(now).toISOString();

    const { error: uploadError } = await supabase.storage
      .from(MAP_TILES_BUCKET)
      .upload(path, bytes, { upsert: false, contentType: "image/png" });
    if (uploadError) {
      console.error("tile upload failed:", path, uploadError);
      continue;
    }

    const row = {
      dimension,
      region_x: tile.rx,
      region_z: tile.rz,
      storage_path: path,
      contributor_player_id: player.id,
      contributor_ign: player.minecraft_ign,
      captured_at: capturedAt,
      uploaded_at: uploadedAt,
    };

    const { data: updated, error: updateError } = await supabase
      .from("map_tiles")
      .update(row)
      .eq("dimension", dimension)
      .eq("region_x", tile.rx)
      .eq("region_z", tile.rz)
      .lt("captured_at", capturedAt)
      .select("storage_path")
      .returns<{ storage_path: string }[]>();
    if (updateError) {
      console.error("tile row update failed:", path, updateError);
      await supabase.storage.from(MAP_TILES_BUCKET).remove([path]);
      continue;
    }

    let accepted = (updated ?? []).length > 0;
    if (!accepted) {
      const { error: insertError } = await supabase.from("map_tiles").insert(row);
      if (!insertError) {
        accepted = true;
      } else if (insertError.code === "23505") {
        const { data: retryUpdated, error: retryError } = await supabase
          .from("map_tiles")
          .update(row)
          .eq("dimension", dimension)
          .eq("region_x", tile.rx)
          .eq("region_z", tile.rz)
          .lt("captured_at", capturedAt)
          .select("storage_path")
          .returns<{ storage_path: string }[]>();
        if (retryError) {
          console.error("tile row retry update failed:", path, retryError);
        }
        accepted = (retryUpdated ?? []).length > 0;
        if (!accepted) stale++;
      } else {
        console.error("tile row insert failed:", path, insertError);
      }
    }

    if (!accepted) {
      await supabase.storage.from(MAP_TILES_BUCKET).remove([path]);
      continue;
    }

    if (stored?.path && stored.path !== path) {
      await supabase.storage.from(MAP_TILES_BUCKET).remove([stored.path]);
    }
    existingByCell.set(cellKey, { capturedMs: tile.capturedMs, path });
    ok++;
  }

  if (ok === 0 && stale === 0) {
    return {
      error:
        "None of the tiles could be saved. If the map-tiles bucket or table is missing, run supabase/010_map_tiles.sql.",
    };
  }

  if (ok > 0) revalidatePath("/map");
  return { ok, stale };
}
