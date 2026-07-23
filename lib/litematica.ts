/**
 * Litematica material-list import.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * EXTENSION POINT — this is the ONE place to update once a real Litematica
 * export sample is available. Everything else (schema, allocation engine,
 * server actions, UI) already treats an imported list exactly like a
 * hand-entered one, so dropping in the true format is a change to this file
 * alone.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Until then this parser accepts the common shapes people paste today:
 *   - Litematica's in-game "Material List" text table
 *       | Item name | Missing | Available | Total |
 *   - "Name x123" / "Name  123" lines
 *   - "123 x Name" lines
 *   - CSV: "name,count" or "minecraft:id,count"
 *
 * Output rows use a namespaced item id. When only a display name is present it
 * is slugged to a best-guess `minecraft:<snake_case>` id; the admin can correct
 * the id afterward. Duplicate items are summed.
 */

export interface ParsedMaterial {
  item_id: string;
  display_name: string;
  quantity: number;
}

const NAMESPACED = /^[a-z0-9_.-]+:[a-z0-9_./-]+$/;

/** Best-guess Minecraft id from a human label ("Oak Planks" → minecraft:oak_planks). */
export function slugToItemId(label: string): string {
  const slug = label
    .toLowerCase()
    .trim()
    .replace(/[''`]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug ? `minecraft:${slug}` : "minecraft:unknown";
}

/**
 * Tidy a human-typed item name into clean sentence case: collapse whitespace,
 * lowercase everything, then capitalise the first letter.
 *   "oAk  pLanks" → "Oak planks"   "  IRON ingot " → "Iron ingot"
 */
export function formatItemName(raw: string): string {
  const clean = raw.replace(/\s+/g, " ").trim().toLowerCase();
  if (!clean) return clean;
  return clean[0].toUpperCase() + clean.slice(1);
}

function titleCase(id: string): string {
  const path = id.split(":").at(-1) ?? id;
  return path
    .split(/[_/]/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function pushMaterial(
  out: Map<string, ParsedMaterial>,
  rawName: string,
  quantity: number
): void {
  if (!Number.isFinite(quantity) || quantity <= 0) return;
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) return;

  const looksLikeId = NAMESPACED.test(name.toLowerCase());
  const item_id = looksLikeId ? name.toLowerCase() : slugToItemId(name);
  const display_name = looksLikeId ? titleCase(item_id) : name;

  const key = item_id;
  const existing = out.get(key);
  if (existing) existing.quantity += Math.trunc(quantity);
  else
    out.set(key, {
      item_id: item_id.slice(0, 160),
      display_name: display_name.slice(0, 120),
      quantity: Math.trunc(quantity),
    });
}

function parseQuantity(raw: string): number | null {
  // Accept "1,234", "1.234" (thousands), "12k"
  const cleaned = raw.trim().toLowerCase().replace(/[,\s]/g, "");
  const kMatch = cleaned.match(/^(\d+(?:\.\d+)?)k$/);
  if (kMatch) return Math.round(parseFloat(kMatch[1]) * 1000);
  if (!/^\d+$/.test(cleaned.replace(/\./g, ""))) return null;
  const n = Number(cleaned.replace(/\./g, ""));
  return Number.isFinite(n) ? n : null;
}

/** Parse a pasted material list into normalized requirement rows. */
export function parseMaterialList(input: string): ParsedMaterial[] {
  const out = new Map<string, ParsedMaterial>();
  const lines = input.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Skip obvious table borders / headers.
    if (/^[+\-=_|\s]+$/.test(trimmed)) continue;
    if (/^\|?\s*(item|name|material)\b/i.test(trimmed) && /\b(total|count|qty|missing|available)\b/i.test(trimmed)) {
      continue;
    }

    // Pipe / tab table: first cell = name, first numeric cell after = total.
    if (trimmed.includes("|") || trimmed.includes("\t")) {
      const cells = trimmed
        .split(/\t|\|/)
        .map((c) => c.trim())
        .filter((c) => c.length > 0);
      if (cells.length >= 2) {
        const name = cells[0];
        // Prefer the LAST numeric cell (Litematica's "Total" column sits last).
        let qty: number | null = null;
        for (let i = cells.length - 1; i >= 1; i--) {
          qty = parseQuantity(cells[i]);
          if (qty !== null) break;
        }
        if (qty !== null) {
          pushMaterial(out, name, qty);
          continue;
        }
      }
    }

    // CSV: name,count
    const csv = trimmed.match(/^(.+?),\s*(\d[\d.,k]*)$/i);
    if (csv) {
      const qty = parseQuantity(csv[2]);
      if (qty !== null) {
        pushMaterial(out, csv[1], qty);
        continue;
      }
    }

    // "123 x Name" or "123x Name"
    const leading = trimmed.match(/^(\d[\d.,k]*)\s*[x×*]?\s+(.+)$/i);
    if (leading) {
      const qty = parseQuantity(leading[1]);
      if (qty !== null) {
        pushMaterial(out, leading[2], qty);
        continue;
      }
    }

    // "Name x123" / "Name: 123" / "Name  123"
    const trailing = trimmed.match(/^(.+?)[\s:]*[x×*]?\s*(\d[\d.,k]*)$/i);
    if (trailing) {
      const qty = parseQuantity(trailing[2]);
      if (qty !== null) {
        pushMaterial(out, trailing[1], qty);
        continue;
      }
    }
  }

  return [...out.values()];
}
