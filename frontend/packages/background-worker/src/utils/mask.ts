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
    false,
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
