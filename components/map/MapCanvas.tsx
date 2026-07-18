"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Minus, Locate } from "lucide-react";

export type DisplayTile = {
  rx: number;
  rz: number;
  url: string;
  ign: string | null;
};

// On-screen pixels per 512-block region at zoom 1. Tiles are stretched to fit.
const CELL = 256;
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 4;

/**
 * Pannable / zoomable coordinate map. Each region tile is absolutely positioned
 * by its (rx, rz); pan and zoom are a single CSS transform on the inner layer —
 * no mapping library. Missing regions are simply the unexplored frontier.
 */
export function MapCanvas({ tiles }: { tiles: DisplayTile[] }) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  const minRx = Math.min(...tiles.map((t) => t.rx));
  const minRz = Math.min(...tiles.map((t) => t.rz));
  const maxRx = Math.max(...tiles.map((t) => t.rx));
  const maxRz = Math.max(...tiles.map((t) => t.rz));
  const cols = maxRx - minRx + 1;
  const rows = maxRz - minRz + 1;
  const worldW = cols * CELL;
  const worldH = rows * CELL;

  // Center the map in the viewport on first paint.
  const centerView = () => {
    const vp = viewportRef.current;
    if (!vp) return;
    const z = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, Math.min(vp.clientWidth / worldW, vp.clientHeight / worldH, 1))
    );
    setZoom(z);
    setOffset({
      x: (vp.clientWidth - worldW * z) / 2,
      y: (vp.clientHeight - worldH * z) / 2,
    });
  };

  useEffect(() => {
    centerView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    setOffset({
      x: drag.current.ox + (e.clientX - drag.current.x),
      y: drag.current.oy + (e.clientY - drag.current.y),
    });
  }
  function onPointerUp() {
    drag.current = null;
  }

  function zoomAt(factor: number, cx?: number, cy?: number) {
    const vp = viewportRef.current;
    const px = cx ?? (vp ? vp.clientWidth / 2 : 0);
    const py = cy ?? (vp ? vp.clientHeight / 2 : 0);
    setZoom((z) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor));
      const ratio = next / z;
      setOffset((o) => ({
        x: px - (px - o.x) * ratio,
        y: py - (py - o.y) * ratio,
      }));
      return next;
    });
  }

  function onWheel(e: React.WheelEvent) {
    const rect = viewportRef.current?.getBoundingClientRect();
    zoomAt(
      e.deltaY < 0 ? 1.1 : 1 / 1.1,
      rect ? e.clientX - rect.left : undefined,
      rect ? e.clientY - rect.top : undefined
    );
  }

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950">
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        className="h-[70vh] w-full cursor-grab touch-none select-none active:cursor-grabbing"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        <div
          className="relative origin-top-left"
          style={{
            width: worldW,
            height: worldH,
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          }}
        >
          {tiles.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${t.rx}_${t.rz}`}
              src={t.url}
              alt={`Region ${t.rx}, ${t.rz}`}
              draggable={false}
              title={t.ign ? `Region ${t.rx}, ${t.rz} · charted by ${t.ign}` : `Region ${t.rx}, ${t.rz}`}
              className="absolute [image-rendering:pixelated]"
              style={{
                left: (t.rx - minRx) * CELL,
                top: (t.rz - minRz) * CELL,
                width: CELL,
                height: CELL,
              }}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={() => zoomAt(1.25)}
          aria-label="Zoom in"
          className="pressable inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/90 text-slate-300 hover:border-gold-500/50 hover:text-gold-300"
        >
          <Plus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => zoomAt(0.8)}
          aria-label="Zoom out"
          className="pressable inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/90 text-slate-300 hover:border-gold-500/50 hover:text-gold-300"
        >
          <Minus className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={centerView}
          aria-label="Recenter"
          className="pressable inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/90 text-slate-300 hover:border-gold-500/50 hover:text-gold-300"
        >
          <Locate className="h-4 w-4" />
        </button>
      </div>

      <p className="pointer-events-none absolute left-3 top-3 rounded-full border border-slate-700 bg-slate-950/80 px-2.5 py-0.5 text-xs tracking-wide text-slate-400 backdrop-blur">
        {tiles.length} {tiles.length === 1 ? "region" : "regions"} charted · drag to pan · scroll to zoom
      </p>
    </div>
  );
}
