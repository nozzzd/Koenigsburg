"use server";

import { revalidatePath } from "next/cache";
import {
  getSupabase,
  MAP_TILES_BUCKET,
  type MapDimension,
} from "@/lib/supabase";
import { getSessionPlayer } from "@/lib/session";

/** Result of a tile-upload batch, reported back to the client uploader. */
export type SubmitTilesResult = { error: string } | { ok: number };

const DIMENSIONS: MapDimension[] = ["overworld", "nether", "end"];
// One request may not carry the whole world — the client slices then uploads in
// batches to stay under Vercel's ~4.5 MB body cap. Guard the batch size anyway.
const MAX_TILES_PER_BATCH = 32;

function parseRegion(value: FormDataEntryValue | null): number | null {
  const n = Number(String(value ?? "").trim());
  return Number.isInteger(n) ? n : null;
}

/**
 * Store one batch of region tiles. Each tile overwrites its (dimension, x, z)
 * cell — newest wins. Session is re-checked here; the client is never trusted.
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

  if (tiles.length === 0) return { error: "No tiles were received." };
  if (tiles.length !== xs.length || tiles.length !== zs.length) {
    return { error: "Malformed upload — tile/coordinate counts don't match." };
  }
  if (tiles.length > MAX_TILES_PER_BATCH) {
    return { error: "Too many tiles in one batch." };
  }

  const supabase = getSupabase();
  const uploadedAt = new Date().toISOString();
  let ok = 0;

  for (let i = 0; i < tiles.length; i++) {
    const rx = parseRegion(xs[i]);
    const rz = parseRegion(zs[i]);
    if (rx === null || rz === null) continue;

    const path = `${dimension}/${rx}_${rz}.png`;

    const { error: uploadError } = await supabase.storage
      .from(MAP_TILES_BUCKET)
      .upload(path, tiles[i], { upsert: true, contentType: "image/png" });
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
        uploaded_at: uploadedAt,
      },
      { onConflict: "dimension,region_x,region_z" }
    );
    if (rowError) {
      console.error("tile row upsert failed:", path, rowError);
      continue;
    }
    ok++;
  }

  if (ok === 0) {
    return {
      error:
        "None of the tiles could be saved. If the map-tiles bucket or table is missing, run supabase/010_map_tiles.sql.",
    };
  }

  revalidatePath("/map");
  return { ok };
}
