/**
 * AEGIS GlassCard Component
 * Glassmorphism card with dark theme
 */

import React from 'react';
import { View, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { Colors, Radius, Spacing } from '@/constants/theme';

interface GlassCardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: number;
}

export function GlassCard({ children, style, padding = Spacing.md }: GlassCardProps) {
  return (
    <View style={[styles.card, { padding }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.bgGlass,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.bgBorder,
  },
});
