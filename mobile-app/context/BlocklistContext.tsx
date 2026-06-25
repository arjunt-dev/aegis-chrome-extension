/**
 * AEGIS Blocklist Context
 * Global state management for blocked URLs
 */

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import type { BlockedUrl } from '@/types';
import {
  getBlockedUrls,
  addBlockedUrl as addToStorage,
  removeBlockedUrl as removeFromStorage,
  isUrlBlocked as checkIsBlocked,
  clearAllBlockedUrls,
} from '@/storage/blocklist';

interface BlocklistContextValue {
  blockedUrls: BlockedUrl[];
  blockedCount: number;
  isLoading: boolean;
  addBlockedUrl: (entry: BlockedUrl) => Promise<void>;
  removeBlockedUrl: (url: string) => Promise<void>;
  isUrlBlocked: (url: string) => Promise<boolean>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

const BlocklistContext = createContext<BlocklistContextValue | null>(null);

export function BlocklistProvider({ children }: { children: React.ReactNode }) {
  const [blockedUrls, setBlockedUrls] = useState<BlockedUrl[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const list = await getBlockedUrls();
      setBlockedUrls(list);
    } catch {
      setBlockedUrls([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addBlockedUrl = useCallback(async (entry: BlockedUrl) => {
    await addToStorage(entry);
    await refresh();
  }, [refresh]);

  const removeBlockedUrl = useCallback(async (url: string) => {
    await removeFromStorage(url);
    await refresh();
  }, [refresh]);

  const isUrlBlocked = useCallback(async (url: string): Promise<boolean> => {
    return checkIsBlocked(url);
  }, []);

  const clearAll = useCallback(async () => {
    await clearAllBlockedUrls();
    await refresh();
  }, [refresh]);

  return (
    <BlocklistContext.Provider
      value={{
        blockedUrls,
        blockedCount: blockedUrls.length,
        isLoading,
        addBlockedUrl,
        removeBlockedUrl,
        isUrlBlocked,
        clearAll,
        refresh,
      }}
    >
      {children}
    </BlocklistContext.Provider>
  );
}

export function useBlocklist(): BlocklistContextValue {
  const ctx = useContext(BlocklistContext);
  if (!ctx) {
    throw new Error('useBlocklist must be used within a BlocklistProvider');
  }
  return ctx;
}
