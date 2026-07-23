import { createElement } from "react";
import { ItemIcon } from "@/components/ItemIcon";
import { symbolIcon } from "./symbols";
import type { MarkerIconKind } from "@/lib/atlas";

/**
 * Renders a marker's glyph. Waypoints are a colour-filled diamond; symbols are
 * a curated pin badge in the layer colour; items are true Minecraft icons.
 * `size` is the glyph's screen size in px - it never scales with map zoom.
 */
export function MarkerGlyph({
  kind,
  icon,
  color,
  size = 26,
}: {
  kind: MarkerIconKind;
  icon: string;
  color: string;
  size?: number;
}) {
  if (kind === "item") {
    return (
      <span
        className="flex items-center justify-center rounded-[3px] mc-slot"
        style={{ width: size, height: size }}
      >
        <ItemIcon itemId={icon || "minecraft:map"} label={icon} className="h-[78%] w-[78%]" />
      </span>
    );
  }

  if (kind === "symbol") {
    return (
      <span
        className="flex items-center justify-center rounded-full border border-black/40 shadow-md"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
        }}
      >
        {createElement(symbolIcon(icon), {
          className: "h-[62%] w-[62%] text-white drop-shadow",
          strokeWidth: 2.25,
          "aria-hidden": true,
        })}
      </span>
    );
  }

  // Waypoint: a rotated square (diamond) with a white rim, like a beacon marker.
  return (
    <span
      className="block rotate-45 rounded-[3px] border-2 border-white/90 shadow-md"
      style={{ width: size * 0.72, height: size * 0.72, backgroundColor: color }}
      aria-hidden
    />
  );
}
