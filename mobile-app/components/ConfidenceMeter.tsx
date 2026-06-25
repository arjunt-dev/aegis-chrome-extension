/**
 * AEGIS ConfidenceMeter Component
 * Visual confidence bar indicator
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import type { PredictionLabel } from '@/types';
import { getPredictionColor } from '@/utils/url';
import { Colors, Radius, Typography, Spacing } from '@/constants/theme';

interface ConfidenceMeterProps {
  confidence: number; // 0–1
  prediction: PredictionLabel;
}

export function ConfidenceMeter({ confidence, prediction }: ConfidenceMeterProps) {
  const animatedWidth = useRef(new Animated.Value(0)).current;
  const color = getPredictionColor(prediction);
  const percentage = Math.round(confidence * 100);

  useEffect(() => {
    Animated.timing(animatedWidth, {
      toValue: confidence,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [confidence, animatedWidth]);

  const barWidth = animatedWidth.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={styles.container}>
      <View style={styles.labelRow}>
        <Text style={styles.label}>Confidence</Text>
        <Text style={[styles.percentage, { color }]}>{percentage}%</Text>
      </View>
      <View style={styles.track}>
        <Animated.View
          style={[
            styles.bar,
            {
              width: barWidth,
              backgroundColor: color,
            },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    fontWeight: Typography.fontWeightMedium,
  },
  percentage: {
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightBold,
  },
  track: {
    height: 6,
    backgroundColor: Colors.bgGlass,
    borderRadius: Radius.full,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.bgBorder,
  },
  bar: {
    height: '100%',
    borderRadius: Radius.full,
  },
});
