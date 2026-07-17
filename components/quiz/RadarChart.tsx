"use client";

import { useEffect, useState } from "react";
import { ARCHETYPES, type ArchetypeKey } from "@/lib/quiz";

/**
 * Hand-built SVG radar (spider) chart — no charting dependency. Six spokes,
 * one per archetype, drawn clockwise from the top. A faint "nation average"
 * polygon sits behind the player's gold polygon to mirror the two-series look
 * of the reference image. The player polygon animates from the centre out on
 * mount (reduced-motion collapses it to an instant draw).
 */

// A gentle baseline so every recruit is measured against "the average citizen".
const NATION_AVERAGE: Record<ArchetypeKey, number> = {
  builder: 0.55,
  fighter: 0.5,
  gatherer: 0.55,
  roleplayer: 0.45,
  explorer: 0.45,
  statesman: 0.5,
};

const SIZE = 320;
const CENTER = SIZE / 2;
const RADIUS = 118; // leaves room for labels inside the viewBox
const RINGS = 4;

const AXES = ARCHETYPES.map((a, i) => {
  // Start at the top (-90deg) and go clockwise.
  const angle = (-90 + (360 / ARCHETYPES.length) * i) * (Math.PI / 180);
  return { key: a.key, label: a.label, cos: Math.cos(angle), sin: Math.sin(angle) };
});

function point(value: number, cos: number, sin: number) {
  const r = RADIUS * Math.max(0, Math.min(1, value));
  return { x: CENTER + r * cos, y: CENTER + r * sin };
}

function polygon(scores: Record<ArchetypeKey, number>) {
  return AXES.map((axis) => {
    const p = point(scores[axis.key] ?? 0, axis.cos, axis.sin);
    return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
  }).join(" ");
}

export function RadarChart({ scores }: { scores: Record<ArchetypeKey, number> }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const rings = Array.from({ length: RINGS }, (_, i) => {
    const ringRadius = (RADIUS * (i + 1)) / RINGS;
    const pts = AXES.map((axis) => {
      const x = CENTER + ringRadius * axis.cos;
      const y = CENTER + ringRadius * axis.sin;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return pts;
  });

  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      className="mx-auto h-auto w-full max-w-sm"
      role="img"
      aria-label="Your role alignment across the six archetypes"
    >
      {/* Concentric gridlines */}
      {rings.map((pts, i) => (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke="var(--color-slate-700)"
          strokeWidth={1}
          opacity={0.5}
        />
      ))}

      {/* Spokes + labels */}
      {AXES.map((axis) => {
        const end = point(1, axis.cos, axis.sin);
        const label = point(1.2, axis.cos, axis.sin);
        // Nudge labels so they don't collide with the outer ring.
        const anchor = Math.abs(axis.cos) < 0.3 ? "middle" : axis.cos > 0 ? "start" : "end";
        return (
          <g key={axis.key}>
            <line
              x1={CENTER}
              y1={CENTER}
              x2={end.x}
              y2={end.y}
              stroke="var(--color-slate-700)"
              strokeWidth={1}
              opacity={0.4}
            />
            <text
              x={label.x}
              y={label.y}
              textAnchor={anchor}
              dominantBaseline="middle"
              className="fill-slate-400 font-display"
              style={{ fontSize: "11px", letterSpacing: "0.08em" }}
            >
              {axis.label}
            </text>
          </g>
        );
      })}

      {/* Nation average — faint reference series */}
      <polygon
        points={polygon(NATION_AVERAGE)}
        fill="var(--color-slate-500)"
        fillOpacity={0.12}
        stroke="var(--color-slate-500)"
        strokeWidth={1}
        strokeOpacity={0.4}
      />

      {/* The player's alignment — gold, grows from centre on mount */}
      <polygon
        points={polygon(scores)}
        fill="var(--color-gold-400)"
        fillOpacity={0.22}
        stroke="var(--color-gold-400)"
        strokeWidth={2}
        strokeLinejoin="round"
        style={{
          transformOrigin: "center",
          transform: grown ? "scale(1)" : "scale(0)",
          opacity: grown ? 1 : 0,
          transition: "transform 620ms cubic-bezier(0.32, 0.72, 0, 1), opacity 300ms ease",
        }}
      />

      {/* Vertices as small gold dots */}
      {grown &&
        AXES.map((axis) => {
          const p = point(scores[axis.key] ?? 0, axis.cos, axis.sin);
          return (
            <circle
              key={axis.key}
              cx={p.x}
              cy={p.y}
              r={2.5}
              fill="var(--color-gold-300)"
              style={{ animation: "image-in 300ms ease backwards", animationDelay: "500ms" }}
            />
          );
        })}
    </svg>
  );
}
