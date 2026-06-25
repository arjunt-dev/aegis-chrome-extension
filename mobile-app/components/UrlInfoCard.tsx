/**
 * AEGIS UrlInfoCard Component
 * Displays URL and domain info
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { GlassCard } from './GlassCard';
import { Colors, Typography, Spacing } from '@/constants/theme';
import { truncateUrl } from '@/utils/url';

interface UrlInfoCardProps {
  url: string;
  domain: string;
}

export function UrlInfoCard({ url, domain }: UrlInfoCardProps) {
  return (
    <GlassCard>
      <View style={styles.row}>
        <Text style={styles.fieldLabel}>DOMAIN</Text>
        <Text style={styles.domain} numberOfLines={1}>{domain}</Text>
      </View>
      <View style={styles.divider} />
      <View style={styles.row}>
        <Text style={styles.fieldLabel}>FULL URL</Text>
        <Text style={styles.url} numberOfLines={3}>{url}</Text>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.xs,
  },
  fieldLabel: {
    fontSize: Typography.fontSizeXs,
    color: Colors.textMuted,
    fontWeight: Typography.fontWeightSemibold,
    letterSpacing: 1.2,
  },
  domain: {
    fontSize: Typography.fontSizeLg,
    color: Colors.accentTeal,
    fontWeight: Typography.fontWeightSemibold,
  },
  url: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.sm,
  },
});
