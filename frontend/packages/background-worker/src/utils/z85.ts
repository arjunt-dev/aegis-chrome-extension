// z85.ts — Fully universal Z85 encoder/decoder for any data type

const Z85_ALPHABET =
  "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#";

const ENCODE_TABLE = Z85_ALPHABET.split("");
const DECODE_TABLE = new Int8Array(256).fill(-1);
for (let i = 0; i < ENCODE_TABLE.length; i++) {
  DECODE_TABLE[ENCODE_TABLE[i].charCodeAt(0)] = i;
}

// =========================
// === Type Conversions ===
// =========================

function toUint8Array(data: any): Uint8Array {
  if (data instanceof Uint8Array) return data;
  if (data instanceof ArrayBuffer) return new Uint8Array(data);
  if (ArrayBuffer.isView(data)) return new Uint8Array(data.buffer);

  // Browser Blob / File
  if (typeof Blob !== "undefined" && data instanceof Blob) {
    throw new Error("Blobs must be read as ArrayBuffer before encoding.");
  }

  // Node.js Buffer
  if ((globalThis as any).Buffer && data instanceof (globalThis as any).Buffer) {
    return new Uint8Array(data);
  }

  // Plain object or array → serialize JSON
  if (typeof data === "object") {
    const json = JSON.stringify(data);
    return new TextEncoder().encode(json);
  }

  // String
  if (typeof data === "string") {
    return new TextEncoder().encode(data);
  }

  throw new Error(`Unsupported data type: ${typeof data}`);
}

function fromUint8Array(bytes: Uint8Array, originalType?: string): any {
  switch (originalType) {
    case "string":
      return new TextDecoder().decode(bytes);
    case "object":
      return JSON.parse(new TextDecoder().decode(bytes));
    case "Uint8Array":
      return bytes;
    case "ArrayBuffer":
      return bytes.buffer;
    default:
      // try JSON, then fallback to UTF-8
      try {
        return JSON.parse(new TextDecoder().decode(bytes));
      } catch {
        return bytes;
      }
  }
}

// =========================
// === Core Z85 Encode ===
// =========================

export function encode(data: any): string {
  const bytes = toUint8Array(data);
  const padding = (4 - (bytes.length % 4)) % 4;
  const padded = new Uint8Array(bytes.length + padding);
  padded.set(bytes);

  let result = "";
  for (let i = 0; i < padded.length; i += 4) {
    const value =
      ((padded[i] & 0xff) << 24) >>> 0 |
      ((padded[i + 1] & 0xff) << 16) |
      ((padded[i + 2] & 0xff) << 8) |
      (padded[i + 3] & 0xff);

    let divisor = 85 ** 4;
    for (let j = 0; j < 5; j++) {
      const idx = Math.floor(value / divisor) % 85;
      result += ENCODE_TABLE[idx];
      divisor /= 85;
    }
  }

  return result + ENCODE_TABLE[padding];
}

export function decode(z85: string): Uint8Array {
  if (!z85) return new Uint8Array(0);

  const padChar = z85[z85.length - 1];
  const padVal = DECODE_TABLE[padChar.charCodeAt(0)];
  if (padVal < 0 || padVal > 3)
    throw new Error("Invalid Z85 string or corrupted padding marker.");

  const dataPart = z85.slice(0, -1);
  if (dataPart.length % 5 !== 0)
    throw new Error("Corrupted Z85 data length (not multiple of 5).");

  const out = new Uint8Array((dataPart.length / 5) * 4);
  let outIdx = 0;

  for (let i = 0; i < dataPart.length; i += 5) {
    let value = 0;
    for (let j = 0; j < 5; j++) {
      const code = DECODE_TABLE[dataPart.charCodeAt(i + j)];
      if (code < 0)
        throw new Error(`Invalid Z85 character '${dataPart[i + j]}'`);
      value = value * 85 + code;
    }
    out[outIdx++] = (value >>> 24) & 0xff;
    out[outIdx++] = (value >>> 16) & 0xff;
    out[outIdx++] = (value >>> 8) & 0xff;
    out[outIdx++] = value & 0xff;
  }

  return out.subarray(0, out.length - padVal);
}

// =========================
// === Extended Helpers ===
// =========================

/**
 * Encode any value to Z85 string with type metadata
 * (optional wrapper — stores type info).
 */
export function encodeWithType(data: any): string {
  const type =
    data instanceof Uint8Array
      ? "Uint8Array"
      : data instanceof ArrayBuffer
      ? "ArrayBuffer"
      : ArrayBuffer.isView(data)
      ? data.constructor.name
      : typeof data;

  const z85Data = encode(data);
  return JSON.stringify({ type, z85: z85Data });
}

/**
 * Decode from Z85 string with optional type metadata.
 */
export function decodeWithType(input: string): any {
  try {
    const parsed = JSON.parse(input);
    if (parsed && parsed.type && parsed.z85) {
      const bytes = decode(parsed.z85);
      return fromUint8Array(bytes, parsed.type);
    }
  } catch {
    // not wrapped — treat as raw Z85 binary
    return decode(input);
  }
}

// Default export
export default {
  encode,
  decode,
  encodeWithType,
  decodeWithType,
};
