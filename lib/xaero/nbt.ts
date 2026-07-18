// Minimal reader for Java's binary NBT format (big-endian), just enough for
// the block-state compounds Xaero embeds in region files:
//   { Name: "minecraft:oak_leaves", Properties: { persistent: "false", ... } }
// Every other tag type is parsed structurally (so the stream stays in sync)
// but collapsed to primitives we don't use.

export class NbtError extends Error {}

export type NbtValue =
  | number
  | bigint
  | string
  | NbtValue[]
  | { [key: string]: NbtValue };

export type NbtCompound = { [key: string]: NbtValue };

const decoder = new TextDecoder(); // modified UTF-8 ≈ UTF-8 for block/biome names

/** Cursor over a DataView; all reads are big-endian like Java's DataInput. */
export class Reader {
  private view: DataView;
  pos: number;

  constructor(bytes: Uint8Array, pos = 0) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.pos = pos;
  }

  get length(): number {
    return this.view.byteLength;
  }

  u8(): number {
    return this.view.getUint8(this.pos++);
  }
  peekU8(): number {
    return this.view.getUint8(this.pos);
  }
  i8(): number {
    return this.view.getInt8(this.pos++);
  }
  u16(): number {
    const v = this.view.getUint16(this.pos);
    this.pos += 2;
    return v;
  }
  i16(): number {
    const v = this.view.getInt16(this.pos);
    this.pos += 2;
    return v;
  }
  i32(): number {
    const v = this.view.getInt32(this.pos);
    this.pos += 4;
    return v;
  }
  u32(): number {
    const v = this.view.getUint32(this.pos);
    this.pos += 4;
    return v;
  }
  peekI32(): number {
    return this.view.getInt32(this.pos);
  }
  i64(): bigint {
    const v = this.view.getBigInt64(this.pos);
    this.pos += 8;
    return v;
  }
  f32(): number {
    const v = this.view.getFloat32(this.pos);
    this.pos += 4;
    return v;
  }
  f64(): number {
    const v = this.view.getFloat64(this.pos);
    this.pos += 8;
    return v;
  }
  skip(n: number): void {
    this.pos += n;
  }

  /** Java writeUTF: u16 byte length + (modified) UTF-8 bytes. */
  utf(): string {
    const length = this.u16();
    const bytes = new Uint8Array(
      this.view.buffer,
      this.view.byteOffset + this.pos,
      length
    );
    this.pos += length;
    return decoder.decode(bytes);
  }
}

function readPayload(reader: Reader, type: number): NbtValue {
  switch (type) {
    case 1:
      return reader.i8();
    case 2:
      return reader.i16();
    case 3:
      return reader.i32();
    case 4:
      return reader.i64();
    case 5:
      return reader.f32();
    case 6:
      return reader.f64();
    case 7: {
      const length = reader.i32();
      reader.skip(length);
      return length;
    }
    case 8:
      return reader.utf();
    case 9: {
      const itemType = reader.u8();
      const length = reader.i32();
      const list: NbtValue[] = [];
      for (let i = 0; i < length; i++) list.push(readPayload(reader, itemType));
      return list;
    }
    case 10: {
      const compound: NbtCompound = {};
      for (;;) {
        const itemType = reader.u8();
        if (itemType === 0) return compound;
        compound[reader.utf()] = readPayload(reader, itemType);
      }
    }
    case 11: {
      const length = reader.i32();
      reader.skip(length * 4);
      return length;
    }
    case 12: {
      const length = reader.i32();
      reader.skip(length * 8);
      return length;
    }
    default:
      throw new NbtError(`Unknown NBT tag type ${type}.`);
  }
}

/**
 * Reads one named compound from the stream (advancing the reader past it),
 * as written by Java's NbtIo/stream_writer: type byte, name, payload.
 */
export function readCompound(reader: Reader): NbtCompound {
  const type = reader.u8();
  if (type !== 10) throw new NbtError(`Expected compound at root, got ${type}.`);
  reader.utf(); // root name, empty in Xaero files
  return readPayload(reader, 10) as NbtCompound;
}
