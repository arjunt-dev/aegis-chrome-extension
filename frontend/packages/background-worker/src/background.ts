import { deriveKeyFromPassword, encryptData, decryptData } from "./utils/mask";
import { encode, decode } from "../../shared/z85";
import axios from "axios";

axios.defaults.baseURL = "http://localhost:5000";

console.log("Background worker started");

async function Genratesalt() {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return salt;
}

async function GenerateKey(password: string, salt: Uint8Array) {
  const key = await deriveKeyFromPassword(password, salt);
  const jwk = await crypto.subtle.exportKey("jwk", key);
  const jwkString = JSON.stringify(jwk);
  const encodedKey = encode(jwkString);
  await chrome.storage.local.set({ 'key': encodedKey });
}

async function RetrieveKey() {
const stored = await chrome.storage.local.get("key");
  const decodedBytes = decode(stored.key);             
  const decodedString = new TextDecoder().decode(decodedBytes);
  const decodedJwk = JSON.parse(decodedString);
  const importedKey = await crypto.subtle.importKey(
    "jwk",
    decodedJwk,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  return importedKey;
}

async function predictionRequest(endpoint: string,data?: any) {
  try {
    const response = await axios.post(endpoint, { data });
    return response.data;
  } catch (error) {
    console.error("Error making prediction request:", error);
    throw error;
  }
}



chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {

});