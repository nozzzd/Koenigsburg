"use client";

import { useCallback, useState } from "react";
import { createPortal } from "react-dom";
import { ItemIcon } from "@/components/ItemIcon";

export interface InventorySlot {
  key: string;
  itemId: string;
  displayName: string;
  /** Pre-formatted stack count (e.g. "1.2K"). */
  count: string;
  container: string;
  location: string;
  counted: string;
}

interface TipState {
  slot: InventorySlot;
  /** Clamped viewport-x of the tooltip's horizontal centre, in px. */
  cx: number;
  /** Distance from viewport bottom up to the slot's top edge, in px. */
  bottom: number;
  /** When the slot sits too high, anchor below it instead. */
  top: number | null;
  width: number;
}

const MARGIN = 8;
const MAX_W = 260;
const GAP = 10;
const EST_H = 150;

/**
 * The stores rendered as a Minecraft inventory: a grid of recessed slots, each
 * holding a rendered item icon and its stack count. Hovering a slot raises the
 * game's dark item tooltip. The tooltip is a single viewport-fixed element whose
 * position is measured and clamped in JS, so it can never clip off any edge no
 * matter which row or column the slot lives in.
 */
export function InventoryGrid({ slots }: { slots: InventorySlot[] }) {
  const [tip, setTip] = useState<TipState | null>(null);

  const show = useCallback((slot: InventorySlot, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(MAX_W, vw - MARGIN * 2);
    const half = width / 2;
    const centre = rect.left + rect.width / 2;
    const cx = Math.min(Math.max(centre, MARGIN + half), vw - MARGIN - half);
    // Prefer above; drop below when there isn't room up top.
    const roomAbove = rect.top >= EST_H + GAP;
    return setTip({
      slot,
      cx,
      bottom: vh - rect.top + GAP,
      top: roomAbove ? null : rect.bottom + GAP,
      width,
    });
  }, []);

  const hide = useCallback(() => setTip(null), []);

  return (
    <div className="mc-panel rounded-md p-2 sm:p-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))]">
        {slots.map((slot) => (
          <div
            key={slot.key}
            tabIndex={0}
            onMouseEnter={(e) => show(slot, e.currentTarget)}
            onMouseLeave={hide}
            onFocus={(e) => show(slot, e.currentTarget)}
            onBlur={hide}
            className="group relative flex aspect-square items-center justify-center rounded-[3px] outline-none mc-slot focus-visible:ring-2 focus-visible:ring-gold-400/50"
          >
            <ItemIcon
              itemId={slot.itemId}
              label={slot.displayName}
              className="h-[78%] w-[78%]"
            />
            <span className="mc-count pointer-events-none absolute right-1 bottom-0 text-xl">
              {slot.count}
            </span>
          </div>
        ))}
      </div>

      {tip &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            role="tooltip"
            className="pointer-events-none fixed z-[100] -translate-x-1/2 rounded-[3px] px-3 py-2 text-left mc-tooltip"
            style={{
              left: tip.cx,
              width: tip.width,
              ...(tip.top === null ? { bottom: tip.bottom } : { top: tip.top }),
            }}
          >
            <p className="mc-tooltip-title text-base leading-tight text-gold-200">
              {tip.slot.displayName}
            </p>
            <p className="mt-0.5 font-mono text-[0.7rem] text-slate-400">{tip.slot.itemId}</p>
            <div className="mt-1.5 space-y-0.5 text-xs text-slate-300">
              <p>
                <span className="text-slate-500">Count </span>×{tip.slot.count}
              </p>
              <p>
                <span className="text-slate-500">Store </span>
                {tip.slot.container}
              </p>
              <p>
                <span className="text-slate-500">At </span>
                {tip.slot.location}
              </p>
              <p className="text-slate-500">Counted {tip.slot.counted}</p>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
