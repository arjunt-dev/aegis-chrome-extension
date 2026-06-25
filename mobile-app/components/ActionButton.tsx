/**
 * AEGIS ActionButton Component
 * Primary styled button with variants
 */

import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Colors, Radius, Typography, Spacing } from '@/constants/theme';

type ButtonVariant = 'primary' | 'danger' | 'ghost' | 'warning';

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, { bg: string; border: string; text: string }> = {
  primary: {
    bg: Colors.accentTeal,
    border: Colors.accentTeal,
    text: '#0b0f14',
  },
  danger: {
    bg: Colors.accentRedDim,
    border: Colors.accentRedBorder,
    text: Colors.accentRed,
  },
  ghost: {
    bg: Colors.bgGlass,
    border: Colors.bgBorder,
    text: Colors.textSecondary,
  },
  warning: {
    bg: Colors.accentYellowDim,
    border: Colors.accentYellowBorder,
    text: Colors.accentYellow,
  },
};

export function ActionButton({
  label,
  onPress,
  variant = 'ghost',
  loading = false,
  disabled = false,
  style,
  fullWidth = false,
}: ActionButtonProps) {
  const v = variantStyles[variant];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
      style={[
        styles.button,
        {
          backgroundColor: v.bg,
          borderColor: v.border,
          opacity: disabled ? 0.5 : 1,
          width: fullWidth ? '100%' : undefined,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.text} />
      ) : (
        <Text style={[styles.label, { color: v.text }]}>{label}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    minWidth: 80,
  },
  label: {
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    letterSpacing: 0.3,
  },
});
