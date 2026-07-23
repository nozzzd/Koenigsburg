"use client";

import { useState } from "react";

/**
 * A rendered Minecraft item/block icon, sourced from mc.nerothe.com (which
 * renders blocks in 3D and items flat, exactly like the in-game inventory).
 *
 * `itemId` is a namespaced id like "minecraft:grass_block". Non-minecraft
 * namespaces are attempted with their path segment; anything the source can't
 * resolve (a 404) falls back to a lettered tile so the layout never breaks.
 */
function iconUrl(itemId: string): string {
  const path = (itemId.includes(":") ? itemId.split(":").at(-1) : itemId) ?? itemId;
  const clean = path.toLowerCase().replace(/[^a-z0-9_]/g, "");
  return `https://mc.nerothe.com/img/1.21/minecraft_${clean}.png`;
}

function initials(label: string): string {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function ItemIcon({
  itemId,
  label,
  className = "h-8 w-8",
}: {
  itemId: string;
  label: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span
        aria-hidden
        className={`inline-flex items-center justify-center rounded-[3px] bg-slate-800 font-mono text-[0.6rem] font-bold text-slate-400 ${className}`}
      >
        {initials(label)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={iconUrl(itemId)}
      alt={label}
      loading="lazy"
      draggable={false}
      onError={() => setFailed(true)}
      className={`pixelated object-contain ${className}`}
    />
  );
}
