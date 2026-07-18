// Minimal zip reader for Xaero region files (browser-only, no deps).
// A region file is a tiny zip archive holding a single "region.xaero" entry,
// written by Java's ZipOutputStream — which streams, so the LOCAL headers may
// carry zero sizes and the truth lives in the central directory. We therefore
// parse the end-of-central-directory record, walk the central directory, and
// inflate with the browser's native DecompressionStream.

const EOCD_SIG = 0x06054b50;
const CENTRAL_SIG = 0x02014b50;
const LOCAL_SIG = 0x04034b50;

// A region.xaero for a fully-explored 512x512 region is a few hundred KB;
// anything approaching this cap is not a real region file (zip-bomb guard).
const MAX_ENTRY_BYTES = 64 * 1024 * 1024;

export class ZipError extends Error {}

type Entry = {
  name: string;
  method: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

function findEndOfCentralDirectory(view: DataView): number {
  // EOCD is at the very end, preceded only by an optional comment (<= 64K).
  const start = Math.max(0, view.byteLength - 22 - 0xffff);
  for (let i = view.byteLength - 22; i >= start; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) return i;
  }
  throw new ZipError("Not a zip file (no end-of-central-directory record).");
}

function readEntries(bytes: Uint8Array): Entry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(view);
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);

  const decoder = new TextDecoder();
  const entries: Entry[] = [];
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== CENTRAL_SIG) {
      throw new ZipError("Corrupt zip (bad central directory).");
    }
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    entries.push({
      name: decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
      method: view.getUint16(offset + 10, true),
      compressedSize: view.getUint32(offset + 20, true),
      uncompressedSize: view.getUint32(offset + 24, true),
      localHeaderOffset: view.getUint32(offset + 42, true),
    });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function inflateRaw(compressed: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([compressed as BlobPart])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

/** Extracts one entry (default: the region payload) from a zip's bytes. */
export async function readZipEntry(
  bytes: Uint8Array,
  entryName = "region.xaero"
): Promise<Uint8Array> {
  const entry = readEntries(bytes).find((e) => e.name === entryName);
  if (!entry) throw new ZipError(`"${entryName}" not found inside the file.`);
  if (
    entry.compressedSize > MAX_ENTRY_BYTES ||
    entry.uncompressedSize > MAX_ENTRY_BYTES
  ) {
    throw new ZipError("Entry is implausibly large for a region file.");
  }

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const local = entry.localHeaderOffset;
  if (view.getUint32(local, true) !== LOCAL_SIG) {
    throw new ZipError("Corrupt zip (bad local header).");
  }
  // Sizes come from the central directory; the local header only tells us
  // where its own variable-length fields end.
  const nameLength = view.getUint16(local + 26, true);
  const extraLength = view.getUint16(local + 28, true);
  const dataStart = local + 30 + nameLength + extraLength;
  const compressed = bytes.subarray(dataStart, dataStart + entry.compressedSize);

  if (entry.method === 0) return compressed.slice();
  if (entry.method === 8) {
    const inflated = await inflateRaw(compressed);
    if (inflated.byteLength > MAX_ENTRY_BYTES) {
      throw new ZipError("Entry is implausibly large for a region file.");
    }
    return inflated;
  }
  throw new ZipError(`Unsupported zip compression method ${entry.method}.`);
}
