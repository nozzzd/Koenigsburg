"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Plus,
  Minus,
  Locate,
  Maximize2,
  Minimize2,
  MapPin,
  Pentagon,
  MousePointer2,
  PanelLeftClose,
  PanelLeftOpen,
  Eye,
  EyeOff,
  Lock,
  Trash2,
  Check,
  X,
} from "lucide-react";
import type {
  Atlas,
  AtlasClaim,
  AtlasLayer,
  AtlasLayerKind,
  AtlasMarker,
  ClaimPoint,
  DisplayTile,
  MarkerIconKind,
} from "@/lib/atlas";
import { MarkerGlyph } from "./MarkerGlyph";
import { MAP_SYMBOLS } from "./symbols";
import { ItemIcon } from "@/components/ItemIcon";
import {
  createLayer,
  updateLayer,
  deleteLayer,
  createMarker,
  updateMarker,
  deleteMarker,
  createClaim,
  deleteClaim,
} from "@/actions/atlas";

// 256 on-screen px per 512-block region at zoom 1 => 0.5 px per block.
const CELL = 256;
const SCALE = CELL / 512;
const MIN_ZOOM = 0.03;
const MAX_ZOOM = 24;

const COLORS = [
  "#22c55e", "#ef4444", "#3b82f6", "#eab308", "#a855f7", "#ec4899",
  "#f97316", "#14b8a6", "#84cc16", "#06b6d4", "#f43f5e", "#8b5cf6",
  "#e2e8f0", "#64748b",
];

type Mode = "select" | "marker" | "claim";
type Selection = { type: "marker" | "claim" | "layer"; id: string } | null;

export function AtlasMap({
  tiles,
  atlas,
  isAdmin,
}: {
  tiles: DisplayTile[];
  atlas: Atlas;
  isAdmin: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [mouse, setMouse] = useState<{ x: number; y: number } | null>(null);
  const [vpSize, setVpSize] = useState({ w: 0, h: 0 });
  const [isFull, setIsFull] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // Local, editable copies so admin edits show instantly.
  const [layers, setLayers] = useState<AtlasLayer[]>(atlas.layers);
  const [markers, setMarkers] = useState<AtlasMarker[]>(atlas.markers);
  const [claims, setClaims] = useState<AtlasClaim[]>(atlas.claims);

  const [layerVis, setLayerVis] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(atlas.layers.map((l) => [l.id, l.visibleDefault]))
  );
  const [fillClaims, setFillClaims] = useState(true);
  const [showLabels, setShowLabels] = useState(true);

  const [mode, setMode] = useState<Mode>("select");
  const [activeLayerId, setActiveLayerId] = useState<string>(atlas.layers[0]?.id ?? "");
  const [markerKind, setMarkerKind] = useState<MarkerIconKind>("waypoint");
  const [draft, setDraft] = useState<ClaimPoint[]>([]);
  const [sel, setSel] = useState<Selection>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);
  const moved = useRef(false);
  const markerDrag = useRef<{ id: string; moved: boolean } | null>(null);

  const layerById = useMemo(() => new Map(layers.map((l) => [l.id, l])), [layers]);
  const activeLayer = layerById.get(activeLayerId) ?? null;

  // ---- coordinate helpers (all pure over state; no ref reads in render) ----
  const screenOf = useCallback(
    (bx: number, bz: number) => ({
      x: offset.x + bx * SCALE * zoom,
      y: offset.y + bz * SCALE * zoom,
    }),
    [offset, zoom]
  );
  // Viewport-local pixel -> block coordinate.
  const blockFromLocal = useCallback(
    (lx: number, ly: number) => ({
      x: Math.round((lx - offset.x) / zoom / SCALE),
      z: Math.round((ly - offset.y) / zoom / SCALE),
    }),
    [offset, zoom]
  );
  // Client (page) pixel -> block coordinate; only called from event handlers.
  const blockAt = useCallback(
    (clientX: number, clientY: number) => {
      const r = viewportRef.current?.getBoundingClientRect();
      return blockFromLocal(clientX - (r?.left ?? 0), clientY - (r?.top ?? 0));
    },
    [blockFromLocal]
  );

  const hover = mouse ? blockFromLocal(mouse.x, mouse.y) : null;

  // ---- bounds + centering ----
  const bounds = useMemo(() => {
    if (tiles.length === 0) return { minRx: -1, minRz: -1, maxRx: 1, maxRz: 1 };
    return {
      minRx: Math.min(...tiles.map((t) => t.rx)),
      minRz: Math.min(...tiles.map((t) => t.rz)),
      maxRx: Math.max(...tiles.map((t) => t.rx)),
      maxRz: Math.max(...tiles.map((t) => t.rz)),
    };
  }, [tiles]);

  const centerView = useCallback(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const w = (bounds.maxRx - bounds.minRx + 1) * CELL;
    const h = (bounds.maxRz - bounds.minRz + 1) * CELL;
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.min(vp.clientWidth / w, vp.clientHeight / h, 1)));
    const cx = ((bounds.minRx + bounds.maxRx + 1) / 2) * CELL;
    const cy = ((bounds.minRz + bounds.maxRz + 1) / 2) * CELL;
    setZoom(z);
    setOffset({ x: vp.clientWidth / 2 - cx * z, y: vp.clientHeight / 2 - cy * z });
  }, [bounds]);

  useEffect(() => {
    centerView();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onFs = () => setIsFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  // Track the viewport's pixel size in state so render-time culling never has
  // to read a ref.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const measure = () => setVpSize({ w: vp.clientWidth, h: vp.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(vp);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setDraft([]);
        setSel(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ---- zoom ----
  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const vp = viewportRef.current;
    const px = cx ?? (vp ? vp.clientWidth / 2 : 0);
    const py = cy ?? (vp ? vp.clientHeight / 2 : 0);
    setZoom((z) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z * factor));
      const ratio = next / z;
      setOffset((o) => ({ x: px - (px - o.x) * ratio, y: py - (py - o.y) * ratio }));
      return next;
    });
  }, []);

  function onWheel(e: React.WheelEvent) {
    const r = viewportRef.current?.getBoundingClientRect();
    zoomAt(e.deltaY < 0 ? 1.15 : 1 / 1.15, r ? e.clientX - r.left : undefined, r ? e.clientY - r.top : undefined);
  }

  // ---- pointer (pan / place / draw) ----
  function onPointerDown(e: React.PointerEvent) {
    if (markerDrag.current) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    panStart.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    moved.current = false;
  }
  function onPointerMove(e: React.PointerEvent) {
    const r = viewportRef.current?.getBoundingClientRect();
    if (r) setMouse({ x: e.clientX - r.left, y: e.clientY - r.top });

    if (markerDrag.current) {
      const b = blockAt(e.clientX, e.clientY);
      const id = markerDrag.current.id;
      markerDrag.current.moved = true;
      setMarkers((ms) => ms.map((m) => (m.id === id ? { ...m, x: b.x, z: b.z } : m)));
      return;
    }
    if (!panStart.current) return;
    const dx = e.clientX - panStart.current.x;
    const dy = e.clientY - panStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) moved.current = true;
    if (moved.current) setOffset({ x: panStart.current.ox + dx, y: panStart.current.oy + dy });
  }
  function onPointerUp(e: React.PointerEvent) {
    panStart.current = null;
    if (markerDrag.current) return;
    if (moved.current) return; // was a pan, not a click
    const b = blockAt(e.clientX, e.clientY);
    if (isAdmin && mode === "marker") {
      placeMarker(b.x, b.z);
    } else if (isAdmin && mode === "claim") {
      setDraft((d) => [...d, [b.x, b.z]]);
    } else {
      setSel(null);
    }
  }
  function onPointerLeave() {
    panStart.current = null;
    setMouse(null);
  }

  // ---- persistence helpers ----
  const persist = useCallback(
    (run: () => Promise<{ error: string } | { data: unknown }>, onFail?: () => void) => {
      startTransition(async () => {
        const res = await run();
        if ("error" in res) {
          setError(res.error);
          onFail?.();
        } else {
          setError(null);
        }
      });
    },
    []
  );

  function placeMarker(x: number, z: number) {
    if (!activeLayerId) {
      setError("Create a layer first, then place markers on it.");
      return;
    }
    const defaultIcon =
      markerKind === "symbol" ? "flag" : markerKind === "item" ? "minecraft:map" : "";
    startTransition(async () => {
      const res = await createMarker({
        layerId: activeLayerId,
        label: "",
        iconKind: markerKind,
        icon: defaultIcon,
        x,
        z,
        secret: activeLayer?.secret ?? false,
      });
      if ("error" in res) return setError(res.error);
      setError(null);
      setMarkers((ms) => [...ms, res.data]);
      setSel({ type: "marker", id: res.data.id });
    });
  }

  function finishClaim() {
    if (draft.length < 3 || !activeLayerId) {
      setError("A claim needs at least three points on a layer.");
      return;
    }
    const points = draft;
    startTransition(async () => {
      const res = await createClaim({
        layerId: activeLayerId,
        points,
        secret: activeLayer?.secret ?? false,
      });
      if ("error" in res) return setError(res.error);
      setError(null);
      setClaims((cs) => [...cs, res.data]);
      setDraft([]);
      setMode("select");
    });
  }

  function patchMarker(id: string, patch: Partial<AtlasMarker>) {
    setMarkers((ms) => ms.map((m) => (m.id === id ? { ...m, ...patch } : m)));
    persist(() =>
      updateMarker(id, {
        label: patch.label,
        iconKind: patch.iconKind,
        icon: patch.icon,
        x: patch.x,
        z: patch.z,
        showLabel: patch.showLabel,
        showIcon: patch.showIcon,
        secret: patch.secret,
        layerId: patch.layerId,
      })
    );
  }

  function removeMarker(id: string) {
    const prev = markers;
    setMarkers((ms) => ms.filter((m) => m.id !== id));
    setSel(null);
    persist(() => deleteMarker(id), () => setMarkers(prev));
  }

  function removeClaim(id: string) {
    const prev = claims;
    setClaims((cs) => cs.filter((c) => c.id !== id));
    setSel(null);
    persist(() => deleteClaim(id), () => setClaims(prev));
  }

  async function addLayer(kind: AtlasLayerKind) {
    const name = kind === "country" ? "New country" : "New group";
    const color = COLORS[layers.length % COLORS.length];
    const res = await createLayer({ kind, name, color });
    if ("error" in res) return setError(res.error);
    setLayers((ls) => [...ls, res.data]);
    setLayerVis((v) => ({ ...v, [res.data.id]: true }));
    setActiveLayerId(res.data.id);
    setSel({ type: "layer", id: res.data.id });
  }

  function patchLayer(id: string, patch: Partial<AtlasLayer>) {
    setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    persist(() => updateLayer(id, { name: patch.name, color: patch.color, secret: patch.secret }));
  }

  function removeLayer(id: string) {
    const prev = { layers, markers, claims };
    setLayers((ls) => ls.filter((l) => l.id !== id));
    setMarkers((ms) => ms.filter((m) => m.layerId !== id));
    setClaims((cs) => cs.filter((c) => c.layerId !== id));
    if (activeLayerId === id) setActiveLayerId(layers.find((l) => l.id !== id)?.id ?? "");
    setSel(null);
    persist(
      () => deleteLayer(id),
      () => {
        setLayers(prev.layers);
        setMarkers(prev.markers);
        setClaims(prev.claims);
      }
    );
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current?.requestFullscreen?.();
  }

  const isVisible = useCallback(
    (layerId: string) => layerVis[layerId] ?? true,
    [layerVis]
  );

  const countries = layers.filter((l) => l.kind === "country");
  const groups = layers.filter((l) => l.kind === "group");

  const selMarker = sel?.type === "marker" ? markers.find((m) => m.id === sel.id) ?? null : null;
  const selClaim = sel?.type === "claim" ? claims.find((c) => c.id === sel.id) ?? null : null;
  const selLayer = sel?.type === "layer" ? layerById.get(sel.id) ?? null : null;

  const ctrlBtn =
    "pressable inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900/90 text-slate-300 hover:border-gold-500/50 hover:text-gold-300";

  return (
    <div
      ref={containerRef}
      className="relative w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-950"
      style={{ height: isFull ? "100vh" : "70vh" }}
    >
      <div
        ref={viewportRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onWheel={onWheel}
        className="h-full w-full touch-none select-none"
        style={{
          cursor: "none",
          backgroundImage:
            "linear-gradient(rgba(148,163,184,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.06) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      >
        {/* Tiles (scaled) */}
        <div
          className="relative origin-top-left"
          style={{ width: 0, height: 0, transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})` }}
        >
          {tiles.map((t) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${t.rx}_${t.rz}`}
              src={t.url}
              alt={`Region ${t.rx}, ${t.rz}`}
              draggable={false}
              className="absolute [image-rendering:pixelated]"
              style={{ left: t.rx * CELL, top: t.rz * CELL, width: CELL, height: CELL }}
            />
          ))}
        </div>

        {/* Claims + draft (screen-space SVG) */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full">
          {claims.map((c) => {
            const layer = layerById.get(c.layerId);
            if (!layer || !isVisible(c.layerId)) return null;
            const pts = c.points.map((p) => screenOf(p[0], p[1])).map((s) => `${s.x},${s.y}`).join(" ");
            return (
              <polygon
                key={c.id}
                points={pts}
                fill={fillClaims ? layer.color : "none"}
                fillOpacity={fillClaims ? 0.2 : 0}
                stroke={layer.color}
                strokeWidth={sel?.id === c.id ? 3 : 2}
                strokeLinejoin="round"
              />
            );
          })}
          {draft.length > 0 && activeLayer && (
            <>
              <polyline
                points={[...draft, hover ? [hover.x, hover.z] : draft[draft.length - 1]]
                  .map((p) => screenOf(p[0], p[1]))
                  .map((s) => `${s.x},${s.y}`)
                  .join(" ")}
                fill="none"
                stroke={activeLayer.color}
                strokeWidth={2}
                strokeDasharray="6 4"
              />
              {draft.map((p, i) => {
                const s = screenOf(p[0], p[1]);
                return <circle key={i} cx={s.x} cy={s.y} r={4} fill={activeLayer.color} stroke="#fff" strokeWidth={1.5} />;
              })}
            </>
          )}
        </svg>

        {/* Markers (screen-space, constant size) */}
        <div className="pointer-events-none absolute inset-0">
          {markers.map((m) => {
            const layer = layerById.get(m.layerId);
            if (!layer || !isVisible(m.layerId)) return null;
            const s = screenOf(m.x, m.z);
            if (s.x < -80 || s.y < -80 || s.x > vpSize.w + 80 || s.y > vpSize.h + 80)
              return null;
            const selectedHere = sel?.type === "marker" && sel.id === m.id;
            return (
              <div
                key={m.id}
                className="pointer-events-auto absolute flex flex-col items-center"
                style={{ left: s.x, top: s.y, transform: "translate(-50%, -100%)", cursor: isAdmin ? "pointer" : "default" }}
                onPointerDown={(e) => {
                  if (!isAdmin || mode !== "select") return;
                  e.stopPropagation();
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                  markerDrag.current = { id: m.id, moved: false };
                }}
                onPointerMove={(e) => {
                  if (markerDrag.current?.id !== m.id) return;
                  const b = blockAt(e.clientX, e.clientY);
                  setMarkers((ms) => ms.map((x) => (x.id === m.id ? { ...x, x: b.x, z: b.z } : x)));
                }}
                onPointerUp={(e) => {
                  if (markerDrag.current?.id !== m.id) return;
                  e.stopPropagation();
                  const didMove = markerDrag.current.moved;
                  markerDrag.current = null;
                  const cur = markers.find((x) => x.id === m.id);
                  if (didMove && cur) persist(() => updateMarker(m.id, { x: cur.x, z: cur.z }));
                  else setSel({ type: "marker", id: m.id });
                }}
              >
                {m.showIcon && (
                  <MarkerGlyph kind={m.iconKind} icon={m.icon} color={layer.color} size={selectedHere ? 30 : 26} />
                )}
                {m.showLabel && showLabels && m.label && (
                  <span className="mt-0.5 max-w-[10rem] truncate rounded bg-slate-950/85 px-1.5 py-0.5 text-[0.7rem] font-semibold text-slate-100 shadow ring-1 ring-black/40">
                    {m.label}
                  </span>
                )}
                {m.secret && (
                  <Lock className="absolute -right-1 -top-1 h-3 w-3 text-amber-300 drop-shadow" />
                )}
              </div>
            );
          })}
        </div>

        {/* Minecraft crosshair */}
        {mouse && (
          <div
            className="pointer-events-none absolute z-10"
            style={{ left: mouse.x, top: mouse.y, transform: "translate(-50%, -50%)", mixBlendMode: "difference" }}
          >
            <div className="absolute left-1/2 top-1/2 h-[2px] w-[18px] -translate-x-1/2 -translate-y-1/2 bg-white" />
            <div className="absolute left-1/2 top-1/2 h-[18px] w-[2px] -translate-x-1/2 -translate-y-1/2 bg-white" />
          </div>
        )}
      </div>

      {/* Coordinate readout */}
      <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-slate-700 bg-slate-950/85 px-2.5 py-1 font-mono text-xs text-slate-300 backdrop-blur">
        {hover ? (
          <>X <span className="text-gold-300">{hover.x}</span>  Z <span className="text-gold-300">{hover.z}</span></>
        ) : (
          <span className="text-slate-500">move over the map</span>
        )}
      </div>

      {/* Zoom + fullscreen controls */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5">
        <button type="button" onClick={toggleFullscreen} aria-label="Toggle fullscreen" className={ctrlBtn}>
          {isFull ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
        <button type="button" onClick={() => zoomAt(1.3)} aria-label="Zoom in" className={ctrlBtn}>
          <Plus className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => zoomAt(1 / 1.3)} aria-label="Zoom out" className={ctrlBtn}>
          <Minus className="h-4 w-4" />
        </button>
        <button type="button" onClick={centerView} aria-label="Recenter" className={ctrlBtn}>
          <Locate className="h-4 w-4" />
        </button>
      </div>

      {/* Sidebar toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen((v) => !v)}
        aria-label={sidebarOpen ? "Hide panel" : "Show panel"}
        className={`${ctrlBtn} absolute left-3 top-3 z-20`}
      >
        {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      </button>

      {/* Sidebar */}
      {sidebarOpen && (
        <div className="absolute left-3 top-14 z-20 flex max-h-[calc(100%-4.5rem)] w-64 flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-950/90 shadow-xl backdrop-blur">
          <div className="flex items-center justify-between border-b border-slate-800 px-3 py-2">
            <p className="font-display text-[0.7rem] font-bold tracking-[0.2em] text-gold-300">LAYERS</p>
            <div className="flex items-center gap-2 text-[0.65rem] text-slate-400">
              <button
                type="button"
                onClick={() => setFillClaims((v) => !v)}
                className={`rounded px-1.5 py-0.5 ${fillClaims ? "bg-slate-800 text-slate-200" : "text-slate-500"}`}
              >
                Fill
              </button>
              <button
                type="button"
                onClick={() => setShowLabels((v) => !v)}
                className={`rounded px-1.5 py-0.5 ${showLabels ? "bg-slate-800 text-slate-200" : "text-slate-500"}`}
              >
                Names
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-2 py-2">
            <LayerSection
              title="Countries"
              layers={countries}
              isAdmin={isAdmin}
              vis={layerVis}
              markers={markers}
              claims={claims}
              activeLayerId={activeLayerId}
              onToggle={(id) => setLayerVis((v) => ({ ...v, [id]: !(v[id] ?? true) }))}
              onSelect={(id) => { setActiveLayerId(id); setSel({ type: "layer", id }); }}
            />
            <LayerSection
              title="Groups"
              layers={groups}
              isAdmin={isAdmin}
              vis={layerVis}
              markers={markers}
              claims={claims}
              activeLayerId={activeLayerId}
              onToggle={(id) => setLayerVis((v) => ({ ...v, [id]: !(v[id] ?? true) }))}
              onSelect={(id) => { setActiveLayerId(id); setSel({ type: "layer", id }); }}
            />
            {layers.length === 0 && (
              <p className="px-2 py-3 text-xs text-slate-500">
                {isAdmin ? "No layers yet. Add a country or group below." : "Nothing charted here yet."}
              </p>
            )}
          </div>

          {isAdmin && (
            <div className="grid grid-cols-2 gap-1.5 border-t border-slate-800 p-2">
              <button
                type="button"
                onClick={() => addLayer("country")}
                className="pressable rounded-md border border-slate-700 px-2 py-1.5 text-xs font-semibold text-slate-300 hover:border-gold-500/50 hover:text-gold-300"
              >
                + Country
              </button>
              <button
                type="button"
                onClick={() => addLayer("group")}
                className="pressable rounded-md border border-slate-700 px-2 py-1.5 text-xs font-semibold text-slate-300 hover:border-gold-500/50 hover:text-gold-300"
              >
                + Group
              </button>
            </div>
          )}
        </div>
      )}

      {/* Admin toolbar */}
      {isAdmin && (
        <div className="absolute left-1/2 top-3 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-slate-700 bg-slate-950/90 p-1 shadow-xl backdrop-blur">
          <ToolButton active={mode === "select"} onClick={() => { setMode("select"); setDraft([]); }} label="Select">
            <MousePointer2 className="h-4 w-4" />
          </ToolButton>
          <ToolButton active={mode === "marker"} onClick={() => { setMode("marker"); setDraft([]); }} label="Add marker">
            <MapPin className="h-4 w-4" />
          </ToolButton>
          <ToolButton active={mode === "claim"} onClick={() => setMode("claim")} label="Draw claim">
            <Pentagon className="h-4 w-4" />
          </ToolButton>
          <div className="mx-1 h-5 w-px bg-slate-700" />
          <select
            value={activeLayerId}
            onChange={(e) => setActiveLayerId(e.target.value)}
            className="max-w-[9rem] rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 outline-none"
          >
            {layers.length === 0 && <option value="">no layers</option>}
            {layers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.kind === "country" ? "◆ " : "• "}{l.name}
              </option>
            ))}
          </select>
          {mode === "marker" && (
            <select
              value={markerKind}
              onChange={(e) => setMarkerKind(e.target.value as MarkerIconKind)}
              className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-200 outline-none"
            >
              <option value="waypoint">Waypoint</option>
              <option value="symbol">Symbol</option>
              <option value="item">MC item</option>
            </select>
          )}
          {mode === "claim" && draft.length > 0 && (
            <>
              <button type="button" onClick={finishClaim} className="pressable inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
                <Check className="h-3.5 w-3.5" /> Finish ({draft.length})
              </button>
              <button type="button" onClick={() => setDraft([])} className="pressable inline-flex items-center rounded-md border border-slate-700 px-2 py-1.5 text-xs text-slate-300">
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          )}
        </div>
      )}

      {/* Inspector */}
      {isAdmin && (selMarker || selClaim || selLayer) && (
        <div className="absolute right-3 top-3 z-20 max-h-[calc(100%-1.5rem)] w-72 overflow-y-auto rounded-xl border border-slate-700 bg-slate-950/95 p-3 shadow-xl backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <p className="font-display text-[0.7rem] font-bold tracking-[0.2em] text-gold-300">
              {selMarker ? "MARKER" : selClaim ? "CLAIM" : "LAYER"}
            </p>
            <button type="button" onClick={() => setSel(null)} className="text-slate-500 hover:text-slate-300">
              <X className="h-4 w-4" />
            </button>
          </div>

          {selLayer && (
            <LayerInspector
              layer={selLayer}
              onPatch={(p) => patchLayer(selLayer.id, p)}
              onDelete={() => removeLayer(selLayer.id)}
            />
          )}
          {selMarker && (
            <MarkerInspector
              marker={selMarker}
              layers={layers}
              onPatch={(p) => patchMarker(selMarker.id, p)}
              onDelete={() => removeMarker(selMarker.id)}
            />
          )}
          {selClaim && (
            <ClaimInspector
              claim={selClaim}
              onDelete={() => removeClaim(selClaim.id)}
            />
          )}
        </div>
      )}

      {error && (
        <div className="absolute bottom-14 left-1/2 z-30 -translate-x-1/2 rounded-md border border-red-800 bg-red-950/90 px-3 py-1.5 text-xs text-red-200 shadow">
          {error}
        </div>
      )}

      <p className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-slate-700 bg-slate-950/70 px-2.5 py-0.5 text-[0.7rem] tracking-wide text-slate-400 backdrop-blur">
        {tiles.length} {tiles.length === 1 ? "region" : "regions"} · scroll to zoom · drag to pan
      </p>
    </div>
  );
}

// ---- sub-parts ------------------------------------------------------------

function ToolButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`pressable inline-flex h-8 w-8 items-center justify-center rounded-md ${
        active ? "bg-gold-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"
      }`}
    >
      {children}
    </button>
  );
}

function LayerSection({
  title,
  layers,
  isAdmin,
  vis,
  markers,
  claims,
  activeLayerId,
  onToggle,
  onSelect,
}: {
  title: string;
  layers: AtlasLayer[];
  isAdmin: boolean;
  vis: Record<string, boolean>;
  markers: AtlasMarker[];
  claims: AtlasClaim[];
  activeLayerId: string;
  onToggle: (id: string) => void;
  onSelect: (id: string) => void;
}) {
  if (layers.length === 0) return null;
  return (
    <div className="mb-2">
      <p className="px-2 pb-1 text-[0.6rem] font-bold uppercase tracking-widest text-slate-500">{title}</p>
      <ul className="space-y-0.5">
        {layers.map((l) => {
          const shown = vis[l.id] ?? true;
          const count = markers.filter((m) => m.layerId === l.id).length + claims.filter((c) => c.layerId === l.id).length;
          return (
            <li
              key={l.id}
              className={`group flex items-center gap-2 rounded-md px-2 py-1.5 ${activeLayerId === l.id ? "bg-slate-800/70" : "hover:bg-slate-900"}`}
            >
              <button type="button" onClick={() => onToggle(l.id)} className="shrink-0 text-slate-400 hover:text-slate-200" aria-label="Toggle visibility">
                {shown ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5 text-slate-600" />}
              </button>
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: l.color, opacity: shown ? 1 : 0.4 }} />
              <button
                type="button"
                onClick={() => onSelect(l.id)}
                className={`min-w-0 flex-1 truncate text-left text-xs ${shown ? "text-slate-200" : "text-slate-500"}`}
              >
                {l.name}
              </button>
              {l.secret && <Lock className="h-3 w-3 shrink-0 text-amber-300" />}
              <span className="shrink-0 font-mono text-[0.6rem] text-slate-600">{count}</span>
              {isAdmin && activeLayerId === l.id && (
                <span className="shrink-0 text-[0.55rem] font-bold uppercase text-gold-400">active</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mb-2 block">
      <span className="mb-1 block text-[0.65rem] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm text-slate-200 outline-none focus:border-gold-500/60";

function ColorRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1">
      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className={`h-6 w-6 rounded ${value === c ? "ring-2 ring-white" : "ring-1 ring-black/40"}`}
          style={{ backgroundColor: c }}
          aria-label={c}
        />
      ))}
    </div>
  );
}

function Toggle({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-xs ${
        on ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-300" : "border-slate-700 text-slate-400"
      }`}
    >
      {label}
      {on ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
    </button>
  );
}

function DeleteButton({ onDelete, what }: { onDelete: () => void; what: string }) {
  return (
    <button
      type="button"
      onClick={() => { if (confirm(`Delete this ${what}?`)) onDelete(); }}
      className="pressable mt-1 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-red-900/60 px-2 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-950/40"
    >
      <Trash2 className="h-3.5 w-3.5" /> Delete {what}
    </button>
  );
}

function LayerInspector({ layer, onPatch, onDelete }: { layer: AtlasLayer; onPatch: (p: Partial<AtlasLayer>) => void; onDelete: () => void }) {
  return (
    <div>
      <Field label="Name">
        <input defaultValue={layer.name} onBlur={(e) => onPatch({ name: e.target.value })} className={inputCls} />
      </Field>
      <Field label="Colour"><ColorRow value={layer.color} onChange={(c) => onPatch({ color: c })} /></Field>
      <div className="mb-2"><Toggle label="Secret (citizens only)" on={layer.secret} onChange={(v) => onPatch({ secret: v })} /></div>
      <DeleteButton onDelete={onDelete} what="layer" />
    </div>
  );
}

function MarkerInspector({
  marker,
  layers,
  onPatch,
  onDelete,
}: {
  marker: AtlasMarker;
  layers: AtlasLayer[];
  onPatch: (p: Partial<AtlasMarker>) => void;
  onDelete: () => void;
}) {
  return (
    <div>
      <Field label="Label">
        <input defaultValue={marker.label} onBlur={(e) => onPatch({ label: e.target.value })} className={inputCls} placeholder="(optional)" />
      </Field>
      <Field label="Layer">
        <select value={marker.layerId} onChange={(e) => onPatch({ layerId: e.target.value })} className={inputCls}>
          {layers.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      <Field label="Icon">
        <select value={marker.iconKind} onChange={(e) => onPatch({ iconKind: e.target.value as MarkerIconKind })} className={`${inputCls} mb-2`}>
          <option value="waypoint">Waypoint</option>
          <option value="symbol">Symbol</option>
          <option value="item">MC item</option>
        </select>
        {marker.iconKind === "symbol" && (
          <div className="grid grid-cols-6 gap-1">
            {MAP_SYMBOLS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => onPatch({ icon: s.key })}
                title={s.label}
                className={`flex items-center justify-center rounded p-1.5 ${marker.icon === s.key ? "bg-gold-500 text-slate-950" : "text-slate-300 hover:bg-slate-800"}`}
              >
                <s.Icon className="h-4 w-4" />
              </button>
            ))}
          </div>
        )}
        {marker.iconKind === "item" && (
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-[3px] mc-slot">
              <ItemIcon itemId={marker.icon || "minecraft:map"} label={marker.icon} className="h-7 w-7" />
            </span>
            <input
              defaultValue={marker.icon}
              onBlur={(e) => onPatch({ icon: e.target.value.trim() })}
              placeholder="minecraft:diamond"
              className={`${inputCls} font-mono text-xs`}
            />
          </div>
        )}
      </Field>
      <div className="mb-2 grid grid-cols-2 gap-1.5">
        <Field label="X"><input type="number" defaultValue={marker.x} onBlur={(e) => onPatch({ x: Number(e.target.value) })} className={inputCls} /></Field>
        <Field label="Z"><input type="number" defaultValue={marker.z} onBlur={(e) => onPatch({ z: Number(e.target.value) })} className={inputCls} /></Field>
      </div>
      <div className="mb-1.5"><Toggle label="Show icon" on={marker.showIcon} onChange={(v) => onPatch({ showIcon: v })} /></div>
      <div className="mb-1.5"><Toggle label="Show name" on={marker.showLabel} onChange={(v) => onPatch({ showLabel: v })} /></div>
      <div className="mb-2"><Toggle label="Secret (citizens only)" on={marker.secret} onChange={(v) => onPatch({ secret: v })} /></div>
      <DeleteButton onDelete={onDelete} what="marker" />
    </div>
  );
}

function ClaimInspector({ claim, onDelete }: { claim: AtlasClaim; onDelete: () => void }) {
  return (
    <div>
      <p className="mb-2 text-xs text-slate-400">
        {claim.points.length} points{claim.name ? ` · ${claim.name}` : ""}.
        Painted in its layer&apos;s colour.
      </p>
      <DeleteButton onDelete={onDelete} what="claim" />
    </div>
  );
}
