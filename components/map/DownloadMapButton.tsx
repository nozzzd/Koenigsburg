"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import type { DisplayTile } from "./MapCanvas";
import { outlineButtonClass } from "@/components/ui";

// Full-resolution region size for the exported composite (1px = 1 block).
const TILE_PX = 512;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous"; // public bucket → CORS-clean, so the canvas stays exportable
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load ${url}`));
    img.src = url;
  });
}

/**
 * Stitches the currently-charted tiles into one big PNG in the browser and
 * downloads it. No server render, no deps - works logged out and after the event.
 */
export function DownloadMapButton({ tiles }: { tiles: DisplayTile[] }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    if (tiles.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const minRx = Math.min(...tiles.map((t) => t.rx));
      const minRz = Math.min(...tiles.map((t) => t.rz));
      const maxRx = Math.max(...tiles.map((t) => t.rx));
      const maxRz = Math.max(...tiles.map((t) => t.rz));

      const canvas = document.createElement("canvas");
      canvas.width = (maxRx - minRx + 1) * TILE_PX;
      canvas.height = (maxRz - minRz + 1) * TILE_PX;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable.");

      const imgs = await Promise.all(
        tiles.map(async (t) => ({ t, img: await loadImage(t.url) }))
      );
      for (const { t, img } of imgs) {
        ctx.drawImage(
          img,
          (t.rx - minRx) * TILE_PX,
          (t.rz - minRz) * TILE_PX,
          TILE_PX,
          TILE_PX
        );
      }

      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("Could not render the image.");
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "konigsburg-map.png";
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={handleDownload}
        disabled={busy || tiles.length === 0}
        className={`${outlineButtonClass} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        Download full map (PNG)
      </button>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
