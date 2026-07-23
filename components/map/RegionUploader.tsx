"use client";

import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FolderOpen,
  Loader2,
  Upload,
} from "lucide-react";
import { submitTiles } from "@/actions/map";
import { ErrorBanner, inputClass, labelClass } from "@/components/ui";
import { scanWorldMapFolder, type WorldGroup } from "@/lib/xaero/scan";

const BATCH = 12; // tiles per request - keeps each POST well under Vercel's ~4.5MB cap
const MAX_REGIONS = 1200;
const PREVIEW_MAX_PX = 1024;

type Phase = "idle" | "rendering" | "uploading" | "done";
type Failure = { name: string; reason: string };
type RenderedTile = { rx: number; rz: number; blob: Blob; capturedAt: number };

function formatDay(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function RegionUploader() {
  const [groups, setGroups] = useState<WorldGroup[]>([]);
  const [selectedKey, setSelectedKey] = useState<string>("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [saved, setSaved] = useState(0);
  const [stale, setStale] = useState(0);
  const [failures, setFailures] = useState<Failure[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const cancelRef = useRef(false);

  const selected: WorldGroup | undefined =
    groups.find((g) => g.key === selectedKey) ?? groups[0];

  const dateRange = useMemo(() => {
    if (!selected || selected.files.length === 0) return null;
    let min = Infinity;
    let max = -Infinity;
    for (const f of selected.files) {
      min = Math.min(min, f.file.lastModified);
      max = Math.max(max, f.file.lastModified);
    }
    return { min, max };
  }, [selected]);

  function reset() {
    setGroups([]);
    setSelectedKey("");
    setPhase("idle");
    setProgress({ done: 0, total: 0 });
    setSaved(0);
    setStale(0);
    setFailures([]);
    setError(null);
    setNote(null);
    if (fileRef.current) fileRef.current.value = "";
    const canvas = previewRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
  }

  function handleFolder(event: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    setNote(null);
    setPhase("idle");
    setSaved(0);
    setStale(0);
    setFailures([]);
    const files = Array.from(event.target.files ?? []);
    const found = scanWorldMapFolder(files);
    setGroups(found);
    setSelectedKey(found[0]?.key ?? "");
    if (files.length > 0 && found.length === 0) {
      setError(
        "No Xaero map files were found in that folder. Make sure you select the world-map folder itself (see step 1)."
      );
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected || phase !== "idle") return;
    if (selected.files.length > MAX_REGIONS) {
      setError(
        `That world has ${selected.files.length} region files - more than the ${MAX_REGIONS} we can take in one go. Ping an admin and we'll split it.`
      );
      return;
    }

    setError(null);
    setNote(null);
    setFailures([]);
    setSaved(0);
    setStale(0);
    cancelRef.current = false;

    // The parser/renderer (and its color tables) only load once someone
    // actually contributes.
    const [{ readZipEntry }, { parseRegion }, { renderRegion }] =
      await Promise.all([
        import("@/lib/xaero/zip"),
        import("@/lib/xaero/region"),
        import("@/lib/xaero/render"),
      ]);

    // Live preview: one canvas laid out by region coordinates, filled in as
    // regions finish rendering.
    let minRx = Infinity, maxRx = -Infinity, minRz = Infinity, maxRz = -Infinity;
    for (const f of selected.files) {
      minRx = Math.min(minRx, f.rx);
      maxRx = Math.max(maxRx, f.rx);
      minRz = Math.min(minRz, f.rz);
      maxRz = Math.max(maxRz, f.rz);
    }
    const span = Math.max(maxRx - minRx + 1, maxRz - minRz + 1);
    const cell = Math.max(4, Math.min(32, Math.floor(PREVIEW_MAX_PX / span)));
    const preview = previewRef.current;
    const previewCtx = preview?.getContext("2d") ?? null;
    if (preview && previewCtx) {
      preview.width = (maxRx - minRx + 1) * cell;
      preview.height = (maxRz - minRz + 1) * cell;
      previewCtx.clearRect(0, 0, preview.width, preview.height);
    }

    const scratch = document.createElement("canvas");
    scratch.width = 512;
    scratch.height = 512;
    const scratchCtx = scratch.getContext("2d");

    setPhase("rendering");
    setProgress({ done: 0, total: selected.files.length });

    const tiles: RenderedTile[] = [];
    const failed: Failure[] = [];

    for (let i = 0; i < selected.files.length; i++) {
      if (cancelRef.current) break;
      const regionFile = selected.files[i];
      try {
        const zipBytes = new Uint8Array(await regionFile.file.arrayBuffer());
        const parsed = parseRegion(await readZipEntry(zipBytes));
        if (parsed.pixelCount > 0 && scratchCtx) {
          scratchCtx.clearRect(0, 0, 512, 512);
          scratchCtx.putImageData(renderRegion(parsed), 0, 0);
          const blob = await new Promise<Blob | null>((resolve) =>
            scratch.toBlob(resolve, "image/png")
          );
          if (!blob) throw new Error("couldn't encode the tile image");
          tiles.push({
            rx: regionFile.rx,
            rz: regionFile.rz,
            blob,
            capturedAt: regionFile.file.lastModified,
          });
          previewCtx?.drawImage(
            scratch,
            (regionFile.rx - minRx) * cell,
            (regionFile.rz - minRz) * cell,
            cell,
            cell
          );
        }
      } catch (err) {
        failed.push({
          name: regionFile.file.name,
          reason: err instanceof Error ? err.message : "unreadable file",
        });
      }
      setProgress({ done: i + 1, total: selected.files.length });
      // Let the page breathe between regions.
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    setFailures(failed);

    if (cancelRef.current) {
      setNote("Cancelled - nothing was uploaded.");
      setPhase("idle");
      return;
    }
    if (tiles.length === 0) {
      setError(
        failed.length > 0
          ? "None of the region files could be read. Update Xaero's World Map, hop on the server so it re-saves, and try again."
          : "That world's map files are all empty - explore a little first!"
      );
      setPhase("idle");
      return;
    }

    setPhase("uploading");
    setProgress({ done: 0, total: tiles.length });
    let savedCount = 0;
    let staleCount = 0;

    for (let i = 0; i < tiles.length; i += BATCH) {
      if (cancelRef.current) {
        setNote("Stopped early - the regions uploaded so far are on the map.");
        break;
      }
      const batch = tiles.slice(i, i + BATCH);
      const fd = new FormData();
      fd.set("dimension", "overworld");
      for (const t of batch) {
        fd.append("tile", t.blob, `${t.rx}_${t.rz}.png`);
        fd.append("rx", String(t.rx));
        fd.append("rz", String(t.rz));
        fd.append("capturedAt", String(t.capturedAt));
      }
      const res = await submitTiles(fd);
      if ("error" in res) {
        setError(res.error);
        setPhase("idle");
        return;
      }
      savedCount += res.ok;
      staleCount += res.stale;
      setSaved(savedCount);
      setStale(staleCount);
      setProgress({ done: Math.min(i + BATCH, tiles.length), total: tiles.length });
    }

    setPhase("done");
  }

  const busy = phase === "rendering" || phase === "uploading";
  const percent =
    progress.total === 0
      ? 0
      : Math.round((progress.done / progress.total) * 100);

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && <ErrorBanner message={error} />}
      {note && (
        <p className="rounded-lg border border-slate-700 bg-slate-900/60 px-4 py-2.5 text-sm text-slate-300">
          {note}
        </p>
      )}

      {phase === "done" && (
        <div
          role="status"
          className="space-y-1 rounded-lg border border-emerald-900/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300"
        >
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            {saved} region {saved === 1 ? "tile" : "tiles"} added or refreshed on
            the map. Thank you!
          </p>
          {stale > 0 && (
            <p className="pl-6 text-emerald-400/80">
              {stale} {stale === 1 ? "region was" : "regions were"} skipped - the
              map already has newer scouting there.
            </p>
          )}
        </div>
      )}

      {failures.length > 0 && (
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 px-4 py-3 text-xs text-amber-300/90">
          <p className="mb-1 flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="h-3.5 w-3.5" />
            {failures.length} {failures.length === 1 ? "file" : "files"} couldn&apos;t
            be read (the rest went through fine):
          </p>
          <ul className="space-y-0.5 pl-5">
            {failures.slice(0, 5).map((f) => (
              <li key={f.name}>
                {f.name} - {f.reason}
              </li>
            ))}
            {failures.length > 5 && <li>…and {failures.length - 5} more.</li>}
          </ul>
        </div>
      )}

      <div>
        <label htmlFor="map-folder" className={labelClass}>
          Your Xaero map folder
        </label>
        <input
          id="map-folder"
          ref={fileRef}
          type="file"
          multiple
          disabled={busy}
          {...({ webkitdirectory: "" } as Record<string, string>)}
          onChange={handleFolder}
          className="block w-full text-sm text-slate-400 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:font-display file:text-xs file:font-bold file:tracking-wider file:text-gold-300 hover:file:bg-slate-700"
        />
        {selected && (
          <p className="mt-1.5 flex items-center gap-1.5 text-xs text-slate-500">
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-gold-500" />
            {selected.files.length} region{" "}
            {selected.files.length === 1 ? "file" : "files"} found
            {dateRange &&
              ` · scouted ${formatDay(dateRange.min)} – ${formatDay(dateRange.max)}`}
          </p>
        )}
      </div>

      {groups.length > 1 && (
        <div>
          <label htmlFor="map-world" className={labelClass}>
            Which world is our server?
          </label>
          <select
            id="map-world"
            value={selected?.key ?? ""}
            disabled={busy}
            onChange={(e) => setSelectedKey(e.target.value)}
            className={inputClass}
          >
            {groups.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label} - {g.files.length} regions, last played{" "}
                {formatDay(g.newestMs)}
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-slate-500">
            We picked the most recently played one for you - double-check the
            name matches our server.
          </p>
        </div>
      )}

      {(busy || phase === "done") && (
        <div className="space-y-2">
          {busy && (
            <>
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>
                  {phase === "rendering"
                    ? `Reading your map… ${progress.done}/${progress.total}`
                    : `Uploading… ${progress.done}/${progress.total}`}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    cancelRef.current = true;
                  }}
                  className="text-slate-500 underline-offset-2 hover:text-slate-300 hover:underline"
                >
                  Cancel
                </button>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gold-500 transition-[width] duration-200"
                  style={{ width: `${percent}%` }}
                />
              </div>
            </>
          )}
          <div className="overflow-auto rounded-lg border border-slate-800 bg-slate-950/60 p-2 [image-rendering:pixelated]">
            <canvas ref={previewRef} className="mx-auto block max-w-full" />
          </div>
          <p className="text-center text-xs text-slate-500">
            {phase === "done"
              ? "That's what got stitched into the shared map."
              : "Your discoveries, drawn right in your browser - nothing uploads until this finishes."}
          </p>
        </div>
      )}

      {phase === "done" ? (
        <button
          type="button"
          onClick={reset}
          className="btn-gold pressable inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-display text-sm font-bold tracking-wider"
        >
          <Upload className="h-4 w-4" />
          Contribute another map
        </button>
      ) : (
        <button
          type="submit"
          disabled={busy || !selected}
          className="btn-gold pressable inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-display text-sm font-bold tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Upload className="h-4 w-4" />
          )}
          {busy ? "Working…" : "Add my discoveries to the map"}
        </button>
      )}
    </form>
  );
}
