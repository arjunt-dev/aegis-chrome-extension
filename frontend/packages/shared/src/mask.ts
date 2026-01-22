/// <reference types="chrome"/>

import { decode, encode } from "./z85";

const CRYPTO = globalThis.crypto || (self as any).crypto;

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
}
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
  return await CRYPTO.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: 310000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}
export async function encryptData(
  data: any,
  key: any
): Promise<EncryptedPayload> {
  const iv = CRYPTO.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(data);

  const ciphertextBuffer = await CRYPTO.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encodedData
  );

  return {
    ciphertext: bufferToHex(new Uint8Array(ciphertextBuffer)),
    iv: bufferToHex(iv),
  };
}

export async function decryptData(
  payload: EncryptedPayload,
  key: any
): Promise<any> {
  const iv = hexToBuffer(payload.iv);
  const ciphertext = hexToBuffer(payload.ciphertext);

  const decryptedBuffer = await CRYPTO.subtle.decrypt(
    { name: "AES-GCM", iv:iv as BufferSource },
    key,
    ciphertext as BufferSource
  );

  return new TextDecoder().decode(decryptedBuffer);
}

export function bufferToHex(buffer: Uint8Array): string {
  return Array.from(buffer)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function hexToBuffer(hexString: string): Uint8Array {
  const matches = hexString.match(/.{1,2}/g);
  if (!matches) throw new Error("Invalid hex string");
  return new Uint8Array(matches.map((byte) => parseInt(byte, 16)));
}

export async function generateSalt(): Promise<Uint8Array> {
  return crypto.getRandomValues(new Uint8Array(16));
}

export async function storeKey(password: string, salt: Uint8Array): Promise<void> {
  const key = await deriveKeyFromPassword(password, salt);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  const jwkString = JSON.stringify(jwk);
  const encodedKey = encode(jwkString);
  await chrome.storage.local. set({ 
    key: encodedKey,
    salt: Array.from(salt)
  });
}

export async function retrieveKey(): Promise<CryptoKey> {
  const stored = await chrome.storage.local. get("key");
  if (!stored.key) throw new Error('No encryption key found');
  
  const decodedBytes = decode(stored.key);
  const decodedString = new TextDecoder().decode(decodedBytes);
  const decodedJwk = JSON.parse(decodedString);
  
  return await crypto.subtle.importKey(
    "jwk",
    decodedJwk,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}