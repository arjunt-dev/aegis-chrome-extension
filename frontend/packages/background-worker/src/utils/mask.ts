import { argon2id } from "hash-wasm";
const CRYPTO = globalThis.crypto || (self as any).crypto;

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  v: number;
}

/* ===========================
   KEY DERIVATION
=========================== */
export async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const enc = new TextEncoder();

  const keyMaterial = await CRYPTO.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"]
  );

  return CRYPTO.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations: 200_000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

/* ===========================
   RANDOM GENERATORS
=========================== */
export function generateSalt(length = 16): Uint8Array {
  return CRYPTO.getRandomValues(new Uint8Array(length));
}

export function generateMasterKeyBytes(length = 32): Uint8Array {
  return CRYPTO.getRandomValues(new Uint8Array(length));
}

/* ===========================
   AUTH HASH DERIVATION
   Client-side only — never expose raw password to server.

   Primary:  argon2id via hash-wasm (WASM inlined as base64 in the
             bundle — no fetch needed, works in MV3 service workers).
             Params: 64 MiB memory, 3 iterations, parallelism=1.

   Fallback: PBKDF2-HMAC-SHA256 (600,000 iterations) via native
             WebCrypto, used if WASM instantiation fails.
=========================== */
async function deriveAuthHashPBKDF2(password: string, salt: Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await CRYPTO.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveBits"]
  );
  const bits = await CRYPTO.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: 600_000, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return bufferToHex(new Uint8Array(bits));
}

export async function deriveAuthHash(
  password: string,
  salt: Uint8Array
): Promise<string> {
  try {
    // hash-wasm inlines the WASM binary as base64 — no fetch() call at runtime.
    // Requires 'wasm-unsafe-eval' in the extension CSP (added to manifest.json).
    return await argon2id({
      password,
      salt,
      parallelism: 1,
      iterations: 3,
      memorySize: 65536, // 64 MiB
      hashLength: 32,
      outputType: "hex",
    });
  } catch {
    // Fallback: WASM blocked or unavailable in this runtime context
    console.warn("[Crypto] argon2id (hash-wasm) unavailable, using PBKDF2-SHA256 fallback");
    return deriveAuthHashPBKDF2(password, salt);
  }
}

/* ===========================
   CONVERSIONS
=========================== */
export function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBuffer(hex: string): Uint8Array {
  const matches = hex.match(/.{1,2}/g);
  if (!matches) throw new Error("Invalid hex");
  return new Uint8Array(matches.map((b) => parseInt(b, 16)));
}

/* ===========================
   MASTER KEY IMPORT
=========================== */
export async function importMasterKey(
  rawBytes: Uint8Array
): Promise<CryptoKey> {
  return CRYPTO.subtle.importKey(
    "raw",
    rawBytes,
    { name: "AES-GCM" },
    true, // Make extractable for session storage
    ["encrypt", "decrypt"]
  );
}

/* ===========================
   MASTER KEY EXPORT/IMPORT (for session storage)
=========================== */
export async function exportMasterKey(key: CryptoKey): Promise<JsonWebKey> {
  return CRYPTO.subtle.exportKey("jwk", key);
}

export async function importMasterKeyFromJWK(jwk: JsonWebKey): Promise<CryptoKey> {
  return CRYPTO.subtle.importKey(
    "jwk",
    jwk,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}

/* ===========================
   ENCRYPTION
=========================== */
export async function encryptString(
  plaintext: string,
  key: CryptoKey
): Promise<EncryptedPayload> {
  const iv = CRYPTO.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertextBuffer = await CRYPTO.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );

  return {
    ciphertext: bufferToHex(new Uint8Array(ciphertextBuffer)),
    iv: bufferToHex(iv),
    v: 1,
  };
}

export async function decryptString(
  payload: EncryptedPayload,
  key: CryptoKey
): Promise<string> {
  const iv = hexToBuffer(payload.iv);
  const ciphertext = hexToBuffer(payload.ciphertext);

  const decryptedBuffer = await CRYPTO.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decryptedBuffer);
}
