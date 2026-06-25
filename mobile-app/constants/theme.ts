/**
 * AEGIS Theme Constants
 * Cybersecurity-themed dark color palette
 */

export const Colors = {
  // Background
  bgPrimary: '#0b0f14',
  bgSecondary: '#11161d',
  bgGlass: 'rgba(255, 255, 255, 0.06)',
  bgCard: '#141a23',
  bgBorder: 'rgba(255, 255, 255, 0.08)',

  // Text
  textPrimary: '#e5e7eb',
  textSecondary: '#9ca3af',
  textMuted: '#6b7280',

  // Accent Colors
  accentTeal: '#14b8a6',
  accentTealDim: 'rgba(20, 184, 166, 0.15)',
  accentTealBorder: 'rgba(20, 184, 166, 0.3)',

  accentRed: '#ef4444',
  accentRedDim: 'rgba(239, 68, 68, 0.15)',
  accentRedBorder: 'rgba(239, 68, 68, 0.3)',

  accentYellow: '#f59e0b',
  accentYellowDim: 'rgba(245, 158, 11, 0.15)',
  accentYellowBorder: 'rgba(245, 158, 11, 0.3)',

  // Status
  safe: '#14b8a6',
  safeDim: 'rgba(20, 184, 166, 0.15)',
  safeBorder: 'rgba(20, 184, 166, 0.3)',

  suspicious: '#f59e0b',
  suspiciousDim: 'rgba(245, 158, 11, 0.15)',
  suspiciousBorder: 'rgba(245, 158, 11, 0.3)',

  phishing: '#ef4444',
  phishingDim: 'rgba(239, 68, 68, 0.15)',
  phishingBorder: 'rgba(239, 68, 68, 0.3)',

  // UI
  divider: 'rgba(255, 255, 255, 0.06)',
  overlay: 'rgba(11, 15, 20, 0.85)',
  white: '#ffffff',
  transparent: 'transparent',
};

export const Radius = {
  sm: 6,
  md: 10,
  lg: 16,
  xl: 20,
  full: 9999,
};

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const Typography = {
  fontSizeXs: 11,
  fontSizeSm: 13,
  fontSizeMd: 15,
  fontSizeLg: 17,
  fontSizeXl: 20,
  fontSizeXxl: 24,
  fontSizeDisplay: 30,

  fontWeightRegular: '400' as const,
  fontWeightMedium: '500' as const,
  fontWeightSemibold: '600' as const,
  fontWeightBold: '700' as const,
};
