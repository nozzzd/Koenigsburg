// Turns a parsed Xaero region into RGBA pixels, mimicking the mod's own look:
// block top-face color x biome tint, water/foliage handled via forced tints,
// overlays (water over terrain) alpha-averaged in, then a vanilla-map style
// relief shade (brighter on north-facing rises, darker in dips).
//
// Block/biome tables come from colors.json, generated from the vanilla client
// jar by scripts/generate-xaero-colors.py.

import colorsJson from "./colors.json";
import {
  NO_HEIGHT,
  REGION_SIZE,
  type ParsedRegion,
  type PaletteState,
} from "./region";

// [r, g, b, a, tintIndex] — or keyed by "prop=value" variant strings when the
// color depends on the block state.
type BlockEntry = number[] | Record<string, number[]>;
type ColorTable = {
  minecraft: string;
  blocks: Record<string, BlockEntry>;
  // [grass, foliage, dryFoliage, water], each [r, g, b]
  biomes: Record<string, number[][]>;
};

const table = colorsJson as unknown as ColorTable;

const enum Tint {
  None = -1,
  Grass = 0,
  Foliage = 1,
  DryFoliage = 2,
  Redstone = 3,
  Water = 4,
}

const FALLBACK_COLOR = [127, 127, 127, 255, Tint.None]; // unknown/modded blocks
const REDSTONE_TINT = [231, 6, 0];
const WHITE = [255, 255, 255];

const PLAINS = table.biomes.plains ?? [
  [145, 189, 89],
  [119, 171, 47],
  [163, 117, 70],
  [63, 118, 228],
];

function lookupEntry(state: PaletteState): number[] {
  const entry = table.blocks[state.name];
  if (!entry) return FALLBACK_COLOR;
  if (Array.isArray(entry)) return entry;
  // Variant-keyed: pick the entry whose "a=b,c=d" key matches the state.
  for (const [key, color] of Object.entries(entry)) {
    if (key === "") continue;
    const matches = key
      .split(",")
      .every((pair) => {
        const eq = pair.indexOf("=");
        return state.props[pair.slice(0, eq)] === pair.slice(eq + 1);
      });
    if (matches) return color;
  }
  return entry[""] ?? Object.values(entry)[0] ?? FALLBACK_COLOR;
}

/** Base color + effective tint kind for one palette state (region-cacheable). */
function resolveState(state: PaletteState): { rgba: number[]; tint: Tint } {
  const entry = lookupEntry(state);
  const name = state.name;

  // Forced tint classes, mirroring the reference renderer: the model data
  // rarely marks these, but the game always tints them.
  let tint: Tint;
  if (name.includes("redstone")) tint = Tint.Redstone;
  else if (name === "leaf_litter") tint = Tint.DryFoliage;
  else if (name.includes("leaves") || name === "vine") tint = Tint.Foliage;
  else if (name.includes("water")) tint = Tint.Water;
  else tint = (entry[4] ?? Tint.None) as Tint;

  return { rgba: entry, tint };
}

function biomeColors(name: string | undefined): number[][] {
  return (name && table.biomes[name]) || PLAINS;
}

function tintColor(tint: Tint, biome: number[][]): number[] {
  switch (tint) {
    case Tint.Grass:
      return biome[0];
    case Tint.Foliage:
      return biome[1];
    case Tint.DryFoliage:
      return biome[2];
    case Tint.Water:
      return biome[3];
    case Tint.Redstone:
      return REDSTONE_TINT;
    default:
      return WHITE;
  }
}

// Relief shading factors (vs. the pixel one block north).
const SHADE_RAISED = 1.14;
const SHADE_SUNKEN = 0.8;

/** Renders a parsed region to 512x512 RGBA. Unexplored pixels stay transparent. */
export function renderRegion(region: ParsedRegion): ImageData {
  const image = new ImageData(REGION_SIZE, REGION_SIZE);
  const data = image.data;

  const stateCache = region.statePalette.map(resolveState);
  const biomeCache = region.biomePalette.map((name) => biomeColors(name));

  const { stateIdx, biomeIdx, height, overlays } = region;

  for (let pixel = 0; pixel < stateIdx.length; pixel++) {
    const state = stateIdx[pixel];
    if (state === -1) continue;

    const biome = biomeIdx[pixel] === -1 ? PLAINS : biomeCache[biomeIdx[pixel]];

    const base = stateCache[state];
    const baseTint = tintColor(base.tint, biome);
    let r = (base.rgba[0] * baseTint[0]) / 255;
    let g = (base.rgba[1] * baseTint[1]) / 255;
    let b = (base.rgba[2] * baseTint[2]) / 255;

    const overlayList = overlays[pixel];
    if (overlayList) {
      for (const overlayState of overlayList) {
        const overlay = stateCache[overlayState];
        const overlayTint = tintColor(overlay.tint, biome);
        const alpha = (overlay.rgba[3] ?? 255) / 255;
        r += (overlay.rgba[0] * overlayTint[0] * alpha) / 255;
        g += (overlay.rgba[1] * overlayTint[1] * alpha) / 255;
        b += (overlay.rgba[2] * overlayTint[2] * alpha) / 255;
      }
      const n = overlayList.length + 1;
      r /= n;
      g /= n;
      b /= n;
    }

    // Relief: compare to the block one to the north (z-1). At the region's top
    // edge the neighbour lives in another file — leave those unshaded.
    let shade = 1;
    if (pixel >= REGION_SIZE) {
      const north = height[pixel - REGION_SIZE];
      const here = height[pixel];
      if (north !== NO_HEIGHT && here !== NO_HEIGHT && north !== here) {
        shade = here > north ? SHADE_RAISED : SHADE_SUNKEN;
      }
    }

    const offset = pixel * 4;
    data[offset] = Math.min(255, r * shade);
    data[offset + 1] = Math.min(255, g * shade);
    data[offset + 2] = Math.min(255, b * shade);
    data[offset + 3] = 255;
  }

  return image;
}
