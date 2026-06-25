/**
 * AEGIS Local Blocklist Storage
 * Manages blocked URLs using AsyncStorage
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import type { BlockedUrl } from '@/types';

const BLOCKED_URLS_KEY = '@aegis:blocked_urls';

export async function getBlockedUrls(): Promise<BlockedUrl[]> {
  try {
    const raw = await AsyncStorage.getItem(BLOCKED_URLS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as BlockedUrl[];
  } catch {
    return [];
  }
}

export async function addBlockedUrl(entry: BlockedUrl): Promise<void> {
  const list = await getBlockedUrls();
  // Avoid duplicates — update if already present
  const idx = list.findIndex((b) => b.url === entry.url);
  if (idx >= 0) {
    list[idx] = entry;
  } else {
    list.unshift(entry); // newest first
  }
  await AsyncStorage.setItem(BLOCKED_URLS_KEY, JSON.stringify(list));
}

export async function removeBlockedUrl(url: string): Promise<void> {
  const list = await getBlockedUrls();
  const updated = list.filter((b) => b.url !== url);
  await AsyncStorage.setItem(BLOCKED_URLS_KEY, JSON.stringify(updated));
}

export async function isUrlBlocked(url: string): Promise<boolean> {
  const list = await getBlockedUrls();
  return list.some((b) => b.url === url);
}

export async function clearAllBlockedUrls(): Promise<void> {
  await AsyncStorage.removeItem(BLOCKED_URLS_KEY);
}

export async function getBlockedCount(): Promise<number> {
  const list = await getBlockedUrls();
  return list.length;
}
