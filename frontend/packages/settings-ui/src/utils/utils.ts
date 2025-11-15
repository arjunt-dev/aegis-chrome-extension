// utils.ts

// utils.ts
import type { AppSettings } from "./types";

// 🔹 Get settings (placeholder logic — replace later)
export async function getSettings(defaults: AppSettings): Promise<AppSettings> {
  
  return defaults; 
}

// 🔹 Save a single setting (placeholder logic)
export async function saveSetting(key: keyof AppSettings, value: boolean) {
  console.log(key);
  console.log(value);
  return true;
}

// 🔹 Get login status
export async function getLoginStatus(): Promise<boolean> {
  
  return false;
}
