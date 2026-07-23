// Parser for Xaero's World Map region files (the "<rx>_<rz>.zip" files inside
// .minecraft/xaero/world-map/...). Produces a palette-compressed 512x512 pixel
// grid ready for coloring by render.ts.
//
// The layout was reverse-engineered against DanDucky/XaerosMapFormat (GPL C++
// reader) and Gjum's format notes. In short: an optional 0xFF-marked version
// header, then up to 64 tile-chunks (64x64 blocks each), each 4x4 chunks of
// 16x16 pixels. All multi-byte values are big-endian (Java streams); the pixel
// parameter words are read LSB-first. Block states live in an in-file palette
// of NBT compounds ({Name, Properties}) - names, not numeric ids - and biomes
// in a palette of strings, so modern files are fully self-describing.
//
// We support region versions 4.x-7.8 (Minecraft ~1.18+). Older saves predate
// the palettes and would need per-MC-version id tables; the mod rewrites them
// on the next visit anyway, so we ask the player to update/revisit instead.

import { Reader, readCompound, type NbtCompound } from "./nbt";

export const REGION_SIZE = 512;
export const NO_HEIGHT = -32768;

export class XaeroFormatError extends Error {}

/** One palette entry: a block state as stored in the file. */
export type PaletteState = {
  /** Block name without the "minecraft:" namespace, e.g. "oak_leaves". */
  name: string;
  /** Block state properties, e.g. { snowy: "true" }. */
  props: Record<string, string>;
};

export type ParsedRegion = {
  majorVersion: number;
  minorVersion: number;
  /** All block states referenced by the region (grass/water pre-seeded). */
  statePalette: PaletteState[];
  /** Biome names without namespace, e.g. "plains". */
  biomePalette: string[];
  /** 512*512 palette index per pixel, -1 = never explored. Index = z*512+x. */
  stateIdx: Int32Array;
  /** 512*512 biome palette index per pixel, -1 = none recorded. */
  biomeIdx: Int32Array;
  /** 512*512 terrain height (12-bit signed), NO_HEIGHT where unexplored. */
  height: Int16Array;
  /** 512*512 block light 0-15. */
  light: Uint8Array;
  /** Overlay state palette indices per pixel (water etc.), sparse. */
  overlays: (number[] | undefined)[];
  /** Count of explored pixels - 0 means an effectively empty file. */
  pixelCount: number;
};

export const GRASS_STATE_IDX = 0;
export const WATER_STATE_IDX = 1;

// Old numeric biome ids appear only in mid-version files that saved biomes as
// ints. A best-effort table for the common ones; anything else falls back to
// plains tints at render time.
const LEGACY_BIOME_IDS: Record<number, string> = {
  0: "ocean",
  1: "plains",
  2: "desert",
  3: "windswept_hills",
  4: "forest",
  5: "taiga",
  6: "swamp",
  7: "river",
  10: "frozen_ocean",
  11: "frozen_river",
  12: "snowy_plains",
  14: "mushroom_fields",
  16: "beach",
  21: "jungle",
  24: "deep_ocean",
  25: "stony_shore",
  27: "birch_forest",
  29: "dark_forest",
  30: "snowy_taiga",
  35: "savanna",
  37: "badlands",
  44: "warm_ocean",
  45: "lukewarm_ocean",
  46: "cold_ocean",
};

function stripNamespace(name: string): string {
  const colon = name.indexOf(":");
  return colon === -1 ? name : name.slice(colon + 1);
}

function stateFromNbt(nbt: NbtCompound): PaletteState {
  const name =
    typeof nbt.Name === "string" ? stripNamespace(nbt.Name) : "unknown";
  const props: Record<string, string> = {};
  const raw = nbt.Properties;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [key, value] of Object.entries(raw)) {
      if (typeof value === "string") props[key] = value;
    }
  }
  return { name, props };
}

/** Little bit-cursor over one 32-bit parameter word, LSB first. */
class Bits {
  constructor(private word: number, private pos = 0) {}
  next(n: number): number {
    const value = (this.word >>> this.pos) & ((1 << n) - 1);
    this.pos += n;
    return value;
  }
  skip(n: number): void {
    this.pos += n;
  }
  skipToNextByte(): void {
    this.pos = ((this.pos >> 3) + 1) << 3;
  }
}

/** Parses one region.xaero payload (already unzipped). */
export function parseRegion(bytes: Uint8Array): ParsedRegion {
  const reader = new Reader(bytes);

  if (bytes.length === 0) throw new XaeroFormatError("Empty region file.");
  if (reader.peekU8() !== 255) {
    throw new XaeroFormatError(
      "This region was saved by a very old Xaero's World Map version. Update the mod and revisit the area, then try again."
    );
  }
  reader.skip(1);
  const majorVersion = reader.u16();
  const minorVersion = reader.u16();
  if (majorVersion === 2 && minorVersion >= 5) reader.skip(1); // 1.15-vs-1.14 flag
  if (majorVersion < 4) {
    throw new XaeroFormatError(
      "This region was saved by an old Xaero's World Map version. Update the mod and revisit the area, then try again."
    );
  }
  if (majorVersion > 7 || (majorVersion === 7 && minorVersion > 8)) {
    throw new XaeroFormatError(
      `This region uses a newer Xaero format (${majorVersion}.${minorVersion}) than the site understands yet - tell an admin!`
    );
  }
  const usesColorTypes = minorVersion < 5;

  const statePalette: PaletteState[] = [
    { name: "grass_block", props: { snowy: "false" } },
    { name: "water", props: {} },
  ];
  const biomePalette: string[] = [];

  const total = REGION_SIZE * REGION_SIZE;
  const stateIdx = new Int32Array(total).fill(-1);
  const biomeIdx = new Int32Array(total).fill(-1);
  const height = new Int16Array(total).fill(NO_HEIGHT);
  const light = new Uint8Array(total);
  const overlays: (number[] | undefined)[] = new Array(total);
  let pixelCount = 0;

  const readStateIndex = (isNew: boolean): number => {
    if (isNew) {
      statePalette.push(stateFromNbt(readCompound(reader)));
      return statePalette.length - 1;
    }
    const index = reader.i32() + 2; // +2: our virtual grass/water entries
    if (index < 2 || index >= statePalette.length) {
      throw new XaeroFormatError("Corrupt region file (bad state palette index).");
    }
    return index;
  };

  for (let tileCount = 0; tileCount < 64; tileCount++) {
    if (reader.pos >= reader.length) break;

    const coords = reader.u8();
    const tileZ = coords & 0xf;
    const tileX = (coords >> 4) & 0xf;

    for (let chunkX = 0; chunkX < 4; chunkX++) {
      for (let chunkZ = 0; chunkZ < 4; chunkZ++) {
        if (reader.peekI32() === -1) {
          reader.skip(4);
          continue;
        }

        for (let pixelX = 0; pixelX < 16; pixelX++) {
          for (let pixelZ = 0; pixelZ < 16; pixelZ++) {
            const x = (tileX << 6) | (chunkX << 4) | pixelX;
            const z = (tileZ << 6) | (chunkZ << 4) | pixelZ;
            const pixel = z * REGION_SIZE + x;

            const params = new Bits(reader.u32());
            const isNotGrass = params.next(1) === 1;
            const hasOverlays = params.next(1) === 1;
            const colorType = usesColorTypes ? params.next(2) : (params.skip(2), 0);
            const hasSlope = minorVersion === 2 && params.next(1) === 1;
            if (minorVersion !== 2) params.skip(1);
            params.skip(1); // unused bit
            const heightInParams = params.next(1) === 0;
            params.skipToNextByte(); // skips the cave-block bit, aligns to bit 8
            light[pixel] = params.next(4);
            let pixelHeight = params.next(8);
            const hasBiome = params.next(1) === 1;
            const newStateEntry = params.next(1) === 1;
            const newBiomeEntry = params.next(1) === 1;
            const biomeAsInt = params.next(1) === 1;
            const topHeightDiffers =
              minorVersion >= 4 ? params.next(1) === 1 : false;
            if (heightInParams) {
              // 12-bit signed: low 8 bits at 12-19, high 4 at 25-28
              pixelHeight |= params.next(4) << 8;
              if (pixelHeight & 0x800) pixelHeight |= -0x1000; // sign-extend
            }

            stateIdx[pixel] = isNotGrass
              ? readStateIndex(newStateEntry)
              : GRASS_STATE_IDX;

            if (!heightInParams) pixelHeight = reader.u8();
            height[pixel] = pixelHeight;
            if (topHeightDiffers) reader.skip(1); // topHeight - not rendered

            if (hasOverlays) {
              const count = reader.u8();
              const list: number[] = [];
              for (let i = 0; i < count; i++) {
                const overlayParams = new Bits(reader.u32());
                const isWater = overlayParams.next(1) === 0;
                const legacyOpacity = overlayParams.next(1) === 1;
                const customColor = overlayParams.next(1) === 1;
                const hasOpacity = overlayParams.next(1) === 1;
                overlayParams.skip(4); // overlay light - not rendered
                const overlayColorType = usesColorTypes
                  ? overlayParams.next(2)
                  : (overlayParams.skip(2), 0);
                const newOverlayEntry = overlayParams.next(1) === 1;
                // minorVersion >= 8 packs opacity into bits 11-14; not rendered

                list.push(
                  isWater ? WATER_STATE_IDX : readStateIndex(newOverlayEntry)
                );

                if (minorVersion < 1 && legacyOpacity) reader.skip(4);
                if (overlayColorType === 2 || customColor) reader.skip(4);
                if (minorVersion < 8 && hasOpacity) reader.skip(4);
              }
              if (list.length > 0) overlays[pixel] = list;
            }

            if (colorType === 3) reader.skip(4); // legacy custom biome color

            if ((colorType !== 0 && colorType !== 3) || hasBiome) {
              if (newBiomeEntry) {
                if (biomeAsInt) {
                  const id = reader.i32();
                  biomePalette.push(LEGACY_BIOME_IDS[id] ?? "plains");
                } else {
                  biomePalette.push(stripNamespace(reader.utf()));
                }
                biomeIdx[pixel] = biomePalette.length - 1;
              } else {
                const index = reader.u32();
                if (index >= biomePalette.length) {
                  throw new XaeroFormatError(
                    "Corrupt region file (bad biome palette index)."
                  );
                }
                biomeIdx[pixel] = index;
              }
            }

            if (hasSlope) reader.skip(1); // legacy per-pixel slope byte

            pixelCount++;
          }
        }

        if (minorVersion >= 4) reader.skip(1); // chunk interpretation version
        if (minorVersion >= 6) reader.skip(4); // cave layer start
        if (minorVersion >= 7) reader.skip(1); // cave depth
      }
    }
  }

  return {
    majorVersion,
    minorVersion,
    statePalette,
    biomePalette,
    stateIdx,
    biomeIdx,
    height,
    light,
    overlays,
    pixelCount,
  };
}
