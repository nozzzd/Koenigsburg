"use server";

import { revalidatePath } from "next/cache";
import {
  getSupabase,
  MAP_TILES_BUCKET,
  type MapDimension,
} from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";

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
// World border is ±30M blocks → region coords fit comfortably in ±60000.
const MAX_REGION_COORD = 60000;
// A capture date "from the future" would squat its region forever (no honest
// upload could ever beat it), so claims past the server clock get clamped.
const MAX_CLOCK_SKEW_MS = 5 * 60 * 1000;

function parseIntField(value: FormDataEntryValue | null): number | null {
  const n = Number(String(value ?? "").trim());
  return Number.isSafeInteger(n) ? n : null;
}

/** PNG signature + IHDR says 512x512 — cheap validity check, no image lib. */
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
 * read client-side) is NEWER — so uploading a stale map can never wipe fresher
 * scouting. Session is re-checked here; the client is never trusted.
 */
export async function submitTiles(
  formData: FormData
): Promise<SubmitTilesResult> {
  const player = await getSessionPlayer();
  if (!player) return { error: "You must be logged in to contribute tiles." };

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
    return { error: "Malformed upload — field counts don't match." };
  }
  if (tiles.length > MAX_TILES_PER_BATCH) {
    return { error: "Too many tiles in one batch." };
  }

  const supabase = getSupabase();
  const now = Date.now();

  // One query for everything this batch might replace. (.in() is a superset
  // cross-product of the batch coords; exact pairs are matched below.)
  const { data: existingRows, error: existingError } = await supabase
    .from("map_tiles")
    .select("region_x, region_z, captured_at")
    .eq("dimension", dimension)
    .in("region_x", [...new Set(xs.map((x) => Number(x)))])
    .in("region_z", [...new Set(zs.map((z) => Number(z)))]);
  if (existingError) {
    console.error("map_tiles lookup failed:", existingError);
    return {
      error:
        "The map storage isn't reachable. If the map_tiles table is missing, run supabase/010_map_tiles.sql.",
    };
  }
  const existingByCell = new Map<string, number>(
    (existingRows ?? []).map((row) => [
      `${row.region_x}_${row.region_z}`,
      row.captured_at ? Date.parse(row.captured_at) : 0,
    ])
  );

  let ok = 0;
  let stale = 0;

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
    const capturedMs = Math.min(claimedMs, now + MAX_CLOCK_SKEW_MS);

    // Newest wins: never let older scouting overwrite fresher data. (A tie is
    // the same file re-uploaded — also skip.) There is a tiny select-to-write
    // race if two people submit the same region at once; at community scale
    // the loser's data is at most one upload behind and self-heals next time.
    const storedMs = existingByCell.get(`${rx}_${rz}`);
    if (storedMs !== undefined && storedMs >= capturedMs) {
      stale++;
      continue;
    }

    if (tiles[i].size > MAX_TILE_BYTES) continue;
    const bytes = new Uint8Array(await tiles[i].arrayBuffer());
    if (!isRegionPng(bytes)) continue;

    const path = `${dimension}/${rx}_${rz}.png`;

    const { error: uploadError } = await supabase.storage
      .from(MAP_TILES_BUCKET)
      .upload(path, bytes, { upsert: true, contentType: "image/png" });
    if (uploadError) {
      console.error("tile upload failed:", path, uploadError);
      continue;
    }

    const { error: rowError } = await supabase.from("map_tiles").upsert(
      {
        dimension,
        region_x: rx,
        region_z: rz,
        storage_path: path,
        contributor_player_id: player.id,
        contributor_ign: player.minecraft_ign,
        captured_at: new Date(capturedMs).toISOString(),
        uploaded_at: new Date(now).toISOString(),
      },
      { onConflict: "dimension,region_x,region_z" }
    );
    if (rowError) {
      console.error("tile row upsert failed:", path, rowError);
      continue;
    }
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
