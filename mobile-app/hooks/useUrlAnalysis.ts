/**
 * useUrlAnalysis hook
 * Manages URL analysis state and API calls
 */

import { useState, useCallback } from 'react';
import type { AnalysisResult, AnalysisStatus } from '@/types';
import { analyzeUrl } from '@/services/prediction';

interface UseUrlAnalysisResult {
  result: AnalysisResult | null;
  status: AnalysisStatus;
  errorMessage: string | null;
  analyze: (url: string) => Promise<AnalysisResult | null>;
  reset: () => void;
}

export function useUrlAnalysis(): UseUrlAnalysisResult {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [status, setStatus] = useState<AnalysisStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const analyze = useCallback(async (url: string): Promise<AnalysisResult | null> => {
    setStatus('loading');
    setErrorMessage(null);
    setResult(null);

    try {
      const data = await analyzeUrl(url);
      setResult(data);
      setStatus('success');
      return data;
    } catch (error: unknown) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Failed to analyze URL. Please try again.';
      setErrorMessage(msg);
      setStatus('error');
      return null;
    }
  }, []);

  const reset = useCallback(() => {
    setResult(null);
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  return { result, status, errorMessage, analyze, reset };
}
