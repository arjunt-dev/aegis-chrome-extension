/**
 * useIncomingUrl hook
 * Handles incoming URLs from Android intents and deep links
 * Uses expo-linking to detect URLs opened via intent filter
 */

import { useEffect, useCallback } from 'react';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';

function extractTargetUrl(incomingUrl: string): string | null {
  try {
    // Handle aegis:// deep links: aegis://analyze?url=https://example.com
    if (incomingUrl.startsWith('aegis://')) {
      const parsed = new URL(incomingUrl);
      const targetUrl = parsed.searchParams.get('url');
      return targetUrl;
    }

    // Handle direct http/https URLs (when AEGIS is set as default browser)
    if (incomingUrl.startsWith('http://') || incomingUrl.startsWith('https://')) {
      return incomingUrl;
    }

    return null;
  } catch {
    return null;
  }
}

function navigateToAnalysis(url: string) {
  const encoded = encodeURIComponent(url);
  router.push(`/url-analysis?url=${encoded}`);
}

export function useIncomingUrl() {
  const handleUrl = useCallback(({ url }: { url: string }) => {
    if (!url) return;
    const target = extractTargetUrl(url);
    if (target) {
      navigateToAnalysis(target);
    }
  }, []);

  useEffect(() => {
    // Handle URL that launched the app (cold start)
    Linking.getInitialURL().then((url) => {
      if (url) {
        const target = extractTargetUrl(url);
        if (target) {
          // Small delay to ensure navigation stack is ready
          setTimeout(() => navigateToAnalysis(target), 300);
        }
      }
    });

    // Handle URLs when app is already running (warm start)
    const subscription = Linking.addEventListener('url', handleUrl);

    return () => {
      subscription.remove();
    };
  }, [handleUrl]);
}
