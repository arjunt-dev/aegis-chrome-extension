/**
 * AEGIS PredictionBadge Component
 * Shows prediction result with color-coded styling
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { PredictionLabel } from '@/types';
import {
  getPredictionColor,
  getPredictionDimColor,
  getPredictionBorderColor,
  getPredictionLabel,
} from '@/utils/url';
import { Radius, Typography, Spacing } from '@/constants/theme';

interface PredictionBadgeProps {
  prediction: PredictionLabel;
  size?: 'sm' | 'md' | 'lg';
}

export function PredictionBadge({ prediction, size = 'md' }: PredictionBadgeProps) {
  const color = getPredictionColor(prediction);
  const bgColor = getPredictionDimColor(prediction);
  const borderColor = getPredictionBorderColor(prediction);
  const label = getPredictionLabel(prediction);
  const isLarge = size === 'lg';
  const isSm = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: bgColor,
          borderColor,
          paddingHorizontal: isLarge ? Spacing.lg : isSm ? Spacing.sm : Spacing.md,
          paddingVertical: isLarge ? Spacing.sm : isSm ? 3 : Spacing.xs,
          alignContent: 'center',
          marginHorizontal: "auto",
        },
      ]}
    >
      <Text
        style={[
          styles.icon,
          {
            color,
            fontSize: isLarge ? 20 : isSm ? 12 : 15,
            marginRight: isLarge ? 8 : 4,
          },
        ]}
      >
      </Text>
      <Text
        style={[
          styles.label,
          {
            color,
            fontSize: isLarge ? Typography.fontSizeXl : isSm ? Typography.fontSizeXs : Typography.fontSizeMd,
            fontWeight: isLarge ? Typography.fontWeightBold : Typography.fontWeightSemibold,
          },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.full,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  icon: {
    fontWeight: '700',
  },
  label: {
    letterSpacing: 1,
  },
});
