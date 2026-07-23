"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

/**
 * Delete button that *feels* instant: the moment it's pressed, the enclosing
 * row fades and collapses away, while the real server action runs in a
 * transition in the background. If the action throws, the row is restored so
 * nothing silently vanishes.
 */
export function RemoveItemButton({
  action,
  label,
}: {
  action: () => Promise<void>;
  label: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [, startTransition] = useTransition();
  const [gone, setGone] = useState(false);

  function row(): HTMLElement | null {
    return ref.current?.closest("li") ?? null;
  }

  function hide() {
    const li = row();
    if (!li) return;
    li.style.transition = "opacity 140ms ease, transform 140ms ease";
    li.style.opacity = "0";
    li.style.transform = "translateX(10px) scale(0.99)";
  }

  function restore() {
    const li = row();
    if (li) {
      li.style.opacity = "";
      li.style.transform = "";
    }
    setGone(false);
  }

  function handleClick() {
    if (gone) return;
    setGone(true);
    hide();
    startTransition(async () => {
      try {
        await action();
      } catch {
        restore();
      }
    });
  }

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      disabled={gone}
      aria-label={label}
      className="pressable inline-flex items-center gap-1.5 rounded-md border border-slate-800 px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:border-red-800 hover:bg-red-950/40 hover:text-red-300 disabled:opacity-60"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
