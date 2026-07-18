"use client";

import { useRef, useState } from "react";
import { Loader2, Upload, CheckCircle2, ImageUp } from "lucide-react";
import { submitTiles } from "@/actions/map";
import { ErrorBanner, inputClass, labelClass } from "@/components/ui";

// Xaero region = 512x512 blocks. We normalise every sliced tile to 512px
// (1px = 1 block) so partial edge tiles still align on the grid.
const REGION = 512;
const TILE_PX = 512;
const BATCH = 24; // tiles per request — keeps each POST well under Vercel's ~4.5MB cap

type Corner = { x: string; z: string };

/** One region tile ready to upload. */
type SlicedTile = { rx: number; rz: number; blob: Blob };

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file couldn't be read as an image."));
    img.src = URL.createObjectURL(file);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
}

/**
 * Cut the exported image into 512-region-aligned PNG tiles. The two corners give
 * the world coordinates of the image's top-left and bottom-right pixels, from
 * which we derive blocks-per-pixel (auto-correcting for Xaero's export shrink).
 */
async function sliceIntoTiles(
  img: HTMLImageElement,
  tlX: number,
  tlZ: number,
  brX: number,
  brZ: number
): Promise<SlicedTile[]> {
  const west = Math.min(tlX, brX);
  const east = Math.max(tlX, brX);
  const north = Math.min(tlZ, brZ);
  const south = Math.max(tlZ, brZ);

  const blocksPerPxX = (east - west) / img.naturalWidth;
  const blocksPerPxZ = (south - north) / img.naturalHeight;

  const tiles: SlicedTile[] = [];
  const rxStart = Math.floor(west / REGION);
  const rxEnd = Math.floor((east - 1e-6) / REGION);
  const rzStart = Math.floor(north / REGION);
  const rzEnd = Math.floor((south - 1e-6) / REGION);

  for (let rx = rxStart; rx <= rxEnd; rx++) {
    for (let rz = rzStart; rz <= rzEnd; rz++) {
      const regX0 = rx * REGION;
      const regZ0 = rz * REGION;
      // Intersection of this region with the covered world area.
      const ix0 = Math.max(regX0, west);
      const ix1 = Math.min(regX0 + REGION, east);
      const iz0 = Math.max(regZ0, north);
      const iz1 = Math.min(regZ0 + REGION, south);
      if (ix1 <= ix0 || iz1 <= iz0) continue;

      const canvas = document.createElement("canvas");
      canvas.width = TILE_PX;
      canvas.height = TILE_PX;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;

      ctx.drawImage(
        img,
        // source rect (px in the export)
        (ix0 - west) / blocksPerPxX,
        (iz0 - north) / blocksPerPxZ,
        (ix1 - ix0) / blocksPerPxX,
        (iz1 - iz0) / blocksPerPxZ,
        // dest rect inside the 512px cell (1px = 1 block)
        ix0 - regX0,
        iz0 - regZ0,
        ix1 - ix0,
        iz1 - iz0
      );

      const blob = await canvasToBlob(canvas);
      if (blob) tiles.push({ rx, rz, blob });
    }
  }
  return tiles;
}

export function TileUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [tl, setTl] = useState<Corner>({ x: "", z: "" });
  const [br, setBr] = useState<Corner>({ x: "", z: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function num(v: string): number | null {
    const n = Number(v.trim());
    return v.trim() !== "" && Number.isFinite(n) ? n : null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSavedCount(null);

    if (!file) return setError("Choose your exported map image first.");
    const tlX = num(tl.x), tlZ = num(tl.z), brX = num(br.x), brZ = num(br.z);
    if (tlX === null || tlZ === null || brX === null || brZ === null) {
      return setError("Fill in all four corner coordinates (whole or decimal numbers).");
    }
    if (tlX === brX || tlZ === brZ) {
      return setError("The two corners must differ in both X and Z.");
    }

    setBusy(true);
    try {
      const img = await loadImage(file);
      const tiles = await sliceIntoTiles(img, tlX, tlZ, brX, brZ);
      if (tiles.length === 0) {
        setError("No tiles came out of that image — double-check the corner coordinates.");
        return;
      }

      let saved = 0;
      setProgress({ done: 0, total: tiles.length });
      for (let i = 0; i < tiles.length; i += BATCH) {
        const batch = tiles.slice(i, i + BATCH);
        const fd = new FormData();
        fd.set("dimension", "overworld");
        for (const t of batch) {
          fd.append("tile", t.blob, `${t.rx}_${t.rz}.png`);
          fd.append("rx", String(t.rx));
          fd.append("rz", String(t.rz));
        }
        const res = await submitTiles(fd);
        if ("error" in res) {
          setError(res.error);
          return;
        }
        saved += res.ok;
        setProgress({ done: Math.min(i + BATCH, tiles.length), total: tiles.length });
      }

      setSavedCount(saved);
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <ErrorBanner message={error} />}
      {savedCount !== null && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-4 py-2.5 text-sm text-emerald-300"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          {savedCount} region {savedCount === 1 ? "tile" : "tiles"} added to the map. Thank you!
        </p>
      )}

      <div>
        <label htmlFor="map-file" className={labelClass}>
          Your exported map image (PNG)
        </label>
        <input
          id="map-file"
          ref={fileRef}
          type="file"
          accept="image/png,image/*"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:font-display file:text-xs file:font-bold file:tracking-wider file:text-gold-300 hover:file:bg-slate-700"
        />
        {file && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <ImageUp className="h-3.5 w-3.5 text-gold-500" /> {file.name}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <fieldset className="rounded-lg border border-slate-800 p-4">
          <legend className="px-1.5 text-xs font-semibold uppercase tracking-wider text-gold-400">
            Top-left corner
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>X</span>
              <input
                inputMode="numeric"
                value={tl.x}
                onChange={(e) => setTl({ ...tl, x: e.target.value })}
                placeholder="-1200"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Z</span>
              <input
                inputMode="numeric"
                value={tl.z}
                onChange={(e) => setTl({ ...tl, z: e.target.value })}
                placeholder="-800"
                className={inputClass}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-slate-800 p-4">
          <legend className="px-1.5 text-xs font-semibold uppercase tracking-wider text-gold-400">
            Bottom-right corner
          </legend>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className={labelClass}>X</span>
              <input
                inputMode="numeric"
                value={br.x}
                onChange={(e) => setBr({ ...br, x: e.target.value })}
                placeholder="900"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Z</span>
              <input
                inputMode="numeric"
                value={br.z}
                onChange={(e) => setBr({ ...br, z: e.target.value })}
                placeholder="1100"
                className={inputClass}
              />
            </label>
          </div>
        </fieldset>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="btn-gold pressable inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-display text-sm font-bold tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {progress
          ? `Uploading ${progress.done}/${progress.total}…`
          : busy
            ? "Slicing…"
            : "Add my discoveries to the map"}
      </button>
    </form>
  );
}
