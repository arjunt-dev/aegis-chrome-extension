/**
 * AEGIS URL Utilities
 */

import type { PredictionLabel } from '@/types';
import { Colors } from '@/constants/theme';

export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname;
  } catch {
    const match = url.match(/^(?:https?:\/\/)?([^/?#]+)/i);
    return match ? match[1] : url;
  }
}

export function truncateUrl(url: string, maxLength = 60): string {
  if (url.length <= maxLength) return url;
  return url.slice(0, maxLength - 3) + '...';
}

export function formatTimestamp(ts: number): string {
  const date = new Date(ts);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatConfidence(confidence: number): string {
  return `${(confidence * 100).toFixed(1)}%`;
}

export function getPredictionColor(prediction: PredictionLabel): string {
  switch (prediction) {
    case 'safe':
      return Colors.safe;
    case 'suspicious':
      return Colors.suspicious;
    case 'phishing':
      return Colors.phishing;
    default:
      return Colors.textSecondary;
  }
}

export function getPredictionDimColor(prediction: PredictionLabel): string {
  switch (prediction) {
    case 'safe':
      return Colors.safeDim;
    case 'suspicious':
      return Colors.suspiciousDim;
    case 'phishing':
      return Colors.phishingDim;
    default:
      return Colors.bgGlass;
  }
}

export function getPredictionBorderColor(prediction: PredictionLabel): string {
  switch (prediction) {
    case 'safe':
      return Colors.safeBorder;
    case 'suspicious':
      return Colors.suspiciousBorder;
    case 'phishing':
      return Colors.phishingBorder;
    default:
      return Colors.bgBorder;
  }
}

export function getPredictionLabel(prediction: PredictionLabel): string {
  return prediction.toUpperCase();
}

export function getPredictionIcon(prediction: PredictionLabel): string {
  switch (prediction) {
    case 'safe':
      return '✓';
    case 'suspicious':
      return '⚠';
    case 'phishing':
      return '✕';
    default:
      return '?';
  }
}

export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}
