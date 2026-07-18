// Sorts a folder selection (from an <input webkitdirectory>) into candidate
// Xaero worlds. The mod's layout is xaero/world-map/<world>/<dim%N>/<x>_<z>.zip
// with the world folder named e.g. "Multiplayer_play.example.com", but we stay
// permissive: region files are recognised at any depth, dimension comes from a
// "dim%N" path segment when present (overworld otherwise), and every distinct
// parent folder becomes one selectable "world".

export type RegionFile = {
  file: File;
  rx: number;
  rz: number;
};

export type WorldGroup = {
  /** Full parent-directory path — unique per group. */
  key: string;
  /** Friendly name shown in the picker, e.g. "play.example.com". */
  label: string;
  files: RegionFile[];
  /** Newest file date in the group (ms) — used to preselect the right world. */
  newestMs: number;
};

const REGION_NAME = /^(-?\d+)_(-?\d+)\.zip$/;

function dimensionOf(segments: string[]): "overworld" | "nether" | "end" | "other" {
  for (const segment of segments) {
    if (segment === "dim%0") return "overworld";
    if (segment === "dim%-1") return "nether";
    if (segment === "dim%1") return "end";
    if (segment.startsWith("dim%")) return "other";
  }
  return "overworld"; // older layouts keep overworld regions at the world root
}

function labelOf(segments: string[]): string {
  // Prefer the segment just above the dim%N folder; fall back to the deepest
  // folder, then to the selection root itself.
  const dimIndex = segments.findIndex((s) => s.startsWith("dim%"));
  let label =
    dimIndex > 0
      ? segments[dimIndex - 1]
      : segments[segments.length - 1] ?? "your map";
  if (label.startsWith("Multiplayer_")) label = label.slice("Multiplayer_".length);
  // Multiworld servers nest one more level (e.g. mw$default) below the dim
  // folder — surface it so two entries never look identical.
  const extra = dimIndex >= 0 ? segments.slice(dimIndex + 1) : [];
  if (extra.length > 0) label += ` · ${extra.join("/")}`;
  return label;
}

/**
 * Groups the overworld region files out of a folder selection, sorted so the
 * most recently played world comes first.
 */
export function scanWorldMapFolder(files: File[]): WorldGroup[] {
  const groups = new Map<string, WorldGroup>();

  for (const file of files) {
    const match = REGION_NAME.exec(file.name);
    if (!match) continue;

    const path =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name;
    const segments = path.split("/").slice(0, -1); // parent folders only
    if (segments.some((s) => s.toLowerCase().includes("cache"))) continue;
    if (dimensionOf(segments) !== "overworld") continue; // map is overworld-only for now

    const key = segments.join("/");
    let group = groups.get(key);
    if (!group) {
      group = { key, label: labelOf(segments), files: [], newestMs: 0 };
      groups.set(key, group);
    }
    group.files.push({
      file,
      rx: parseInt(match[1], 10),
      rz: parseInt(match[2], 10),
    });
    group.newestMs = Math.max(group.newestMs, file.lastModified);
  }

  return [...groups.values()].sort((a, b) => b.newestMs - a.newestMs);
}
