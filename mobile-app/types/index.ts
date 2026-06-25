/**
 * AEGIS Type Definitions
 */

export type PredictionLabel = 'safe' | 'suspicious' | 'phishing';

export interface PredictRequest {
  url: string;
}

export interface PredictResponse {
  prediction: number;
  confidence: number;
}

export interface AnalysisResult {
  url: string;
  domain: string;
  prediction: PredictionLabel;
  confidence: number;
  timestamp: number;
}

export interface BlockedUrl {
  url: string;
  domain: string;
  blockedAt: number;
  prediction?: PredictionLabel;
  confidence?: number;
}

export type AnalysisStatus =
  | 'idle'
  | 'loading'
  | 'success'
  | 'error'
  | 'blocked';

export interface ApiError {
  message: string;
  code?: string;
}

export type RootStackParamList = {
  '(tabs)': undefined;
  'url-analysis': { url: string };
  'blocked-detail': { url: string };
};
