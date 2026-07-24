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

// [r, g, b, a, tintIndex] - or keyed by "prop=value" variant strings when the
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

// Relief / hillshade. The map is lit from the north-west (the vanilla-map
// convention): a pixel higher than its north + west neighbours faces the light
// and brightens, one lower falls into shadow. Crucially the strength scales
// with how STEEP the terrain is, so tall mountain faces get real contrast and a
// sense of volume, while flat ground stays clean - unlike the old binary
// one-block edge line that made everything look flat.
//
// RELIEF_SPAN is the combined N+W rise (in blocks) at which shading saturates;
// shadows run a touch stronger than highlights because the eye reads darkness
// as depth.
const RELIEF_SPAN = 7;
const RELIEF_LIGHT = 0.16;
const RELIEF_DARK = 0.26;

// Sea rendering. Xaero stores water as a translucent overlay over the seafloor,
// so raw pixels show the bottom and look washed out. Instead we paint water by
// DEPTH (sea level minus the seafloor height it records): shallows keep the
// biome's bright blue and hint at the floor, while deep water fades to a dark
// navy that hides the bottom - giving proper depth perception.
const SEA_LEVEL = 62;
const WATER_MAX_DEPTH = 28;
// How dark/blue the deepest water gets, as a multiple of the shallow tint.
const DEEP_R = 0.3;
const DEEP_G = 0.42;
const DEEP_B = 0.62;

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
    let water = base.tint === Tint.Water;

    const overlayList = overlays[pixel];
    if (overlayList) {
      for (const overlayState of overlayList) {
        const overlay = stateCache[overlayState];
        if (overlay.tint === Tint.Water) water = true;
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

    // Depth-aware water: fade from bright shallow blue to opaque deep navy so
    // the seabed is hidden in deep water and only hinted at in the shallows.
    if (water) {
      const floor = height[pixel];
      const depth = floor === NO_HEIGHT ? 12 : Math.max(0, SEA_LEVEL - floor);
      const t = Math.min(1, depth / WATER_MAX_DEPTH); // 0 shallow .. 1 deep
      const wc = tintColor(Tint.Water, biome);
      const wr = wc[0] * (1 + (DEEP_R - 1) * t);
      const wg = wc[1] * (1 + (DEEP_G - 1) * t);
      const wb = wc[2] * (1 + (DEEP_B - 1) * t);
      // Deeper water hides more of the floor beneath it.
      const cover = 0.62 + 0.36 * t;
      r = r * (1 - cover) + wr * cover;
      g = g * (1 - cover) + wg * cover;
      b = b * (1 - cover) + wb * cover;
    }

    // Relief: hillshade lit from the north-west. We take the drop toward the
    // north AND the west neighbour and scale the shade by the combined slope,
    // so a tall mountain face reads far stronger than a one-block step and
    // east-west ridges get shaded too (the old code only saw north edges, which
    // left slopes looking flat). Region-edge neighbours live in another file;
    // treat a missing side as level rather than skipping the pixel. Water is
    // kept flat so its surface doesn't speckle (its depth shading is enough).
    let shade = 1;
    const here = height[pixel];
    if (!water && here !== NO_HEIGHT) {
      const northPx = pixel - REGION_SIZE;
      const westPx = pixel % REGION_SIZE === 0 ? -1 : pixel - 1;
      const north = northPx >= 0 ? height[northPx] : NO_HEIGHT;
      const west = westPx >= 0 ? height[westPx] : NO_HEIGHT;
      const dNorth = north === NO_HEIGHT ? 0 : here - north;
      const dWest = west === NO_HEIGHT ? 0 : here - west;
      const slope = dNorth + dWest; // >0 faces the NW light, <0 in shadow
      if (slope !== 0) {
        // Saturating response: the first few blocks of relief carry most of the
        // shading, so cliffs don't blow out to pure white/black.
        const t = Math.max(-1, Math.min(1, slope / RELIEF_SPAN));
        shade = 1 + t * (t > 0 ? RELIEF_LIGHT : RELIEF_DARK);
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
