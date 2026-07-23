"use client";

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

/**
 * The stores rendered as a Minecraft inventory: a grid of recessed slots, each
 * holding a rendered item icon and its stack count. Hovering a slot raises the
 * game's dark item tooltip with the full name, id, and where it was last seen.
 */
export function InventoryGrid({ slots }: { slots: InventorySlot[] }) {
  return (
    <div className="mc-panel rounded-md p-2 sm:p-3">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(3.5rem,1fr))]">
        {slots.map((slot) => (
          <div
            key={slot.key}
            className="group relative flex aspect-square items-center justify-center rounded-[3px] mc-slot"
          >
            <ItemIcon
              itemId={slot.itemId}
              label={slot.displayName}
              className="h-[78%] w-[78%]"
            />
            <span className="mc-count pointer-events-none absolute right-1 bottom-0.5 text-sm">
              {slot.count}
            </span>

            {/* Minecraft-style item tooltip. */}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 hidden w-max max-w-[16rem] -translate-x-1/2 rounded-[3px] px-3 py-2 text-left group-hover:block mc-tooltip">
              <p className="mc-tooltip-title text-base leading-tight text-gold-200">
                {slot.displayName}
              </p>
              <p className="mt-0.5 font-mono text-[0.7rem] text-slate-400">{slot.itemId}</p>
              <div className="mt-1.5 space-y-0.5 text-xs text-slate-300">
                <p>
                  <span className="text-slate-500">Count </span>×{slot.count}
                </p>
                <p>
                  <span className="text-slate-500">Store </span>
                  {slot.container}
                </p>
                <p>
                  <span className="text-slate-500">At </span>
                  {slot.location}
                </p>
                <p className="text-slate-500">Counted {slot.counted}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
