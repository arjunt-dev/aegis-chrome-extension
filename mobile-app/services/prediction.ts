/**
 * AEGIS Phishing Prediction API Service
 * Connects to FastAPI backend for URL analysis
 */

import type { PredictRequest, PredictResponse, PredictionLabel, AnalysisResult } from '@/types';

// Configure this to your FastAPI backend URL
// const IP_ADDRESS = "192.168.220.39"
const IP_ADDRESS = "10.0.2.2";
const PORT = 5000;
const API_BASE_URL = `http://${IP_ADDRESS}:${PORT}`; // Local development URL

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    // Fallback extraction
    const match = url.match(/^(?:https?:\/\/)?([^/?#]+)/i);
    return match ? match[1] : url;
  }
}

export async function analyzeUrl(url: string): Promise<AnalysisResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const body: PredictRequest = { url };

    const response = await fetch(`${API_BASE_URL}/api/predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`API error ${response.status}: ${errorText}`);
    }

    const data: PredictResponse = await response.json();
    const rawLabel = data.prediction.toLowerCase();
    const prediction = (rawLabel === 'legitimate' ? 'safe' : rawLabel) as PredictionLabel;

    return {
      url,
      domain: extractDomain(url),
      prediction,
      confidence: Math.min(Math.max(data.confidence, 0), 1), // clamp 0–1
      timestamp: Date.now(),
    };
  } catch (error: unknown) {
    clearTimeout(timeoutId);
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out. Check your API connection.');
      }
      throw error;
    }
    throw new Error('An unexpected error occurred.');
  }
}

export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

export { extractDomain };
