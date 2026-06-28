/**
 * AEGIS Home Screen
 * App info, settings guide, and blocklist summary
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { GlassCard } from '@/components/GlassCard';
import { useBlocklist } from '@/context/BlocklistContext';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import { Search, Shield } from 'lucide-react-native';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { blockedCount, refresh, isLoading } = useBlocklist();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const openDefaultAppsSettings = () => {
    Linking.openSettings().catch(() => {
      // If settings can't be opened, guide user
    });
  };

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + Spacing.md, paddingBottom: insets.bottom + Spacing.xl },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refresh}
          tintColor={Colors.accentTeal}
          colors={[Colors.accentTeal]}
        />
      }
    >
      {/* Logo & Branding */}
      <View style={styles.hero}>
        <View style={styles.logoContainer}>
          <Text style={styles.logoShield}>⬡</Text>
          <Text style={styles.logoInner}>A</Text>
        </View>
        <Text style={styles.appName}>AEGIS</Text>
        <Text style={styles.tagline}>Secure URL Interceptor & Phishing Gateway</Text>
      </View>

      {/* Status Card */}
      <GlassCard style={styles.statusCard}>
        <View style={styles.statusRow}>
          <View style={[styles.statusDot, styles.statusActive]} />
          <Text style={styles.statusText}>Protection Active</Text>
        </View>
        <Text style={styles.statusSubtext}>
          AEGIS will intercept URLs when set as your default browser handler
        </Text>
      </GlassCard>

      {/* Stats Row */}
      <View style={styles.statsRow}>
        <GlassCard style={styles.statCard} padding={Spacing.md}>
          <Text style={styles.statNumber}>{blockedCount}</Text>
          <Text style={styles.statLabel}>Blocked URLs</Text>
        </GlassCard>
        <GlassCard style={styles.statCard} padding={Spacing.md}>
          <Text style={[styles.statNumber, { color: Colors.accentTeal }]}>ON</Text>
          <Text style={styles.statLabel}>Shield Status</Text>
        </GlassCard>
      </View>

      {/* Setup Instructions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Setup Instructions</Text>
        <GlassCard>
          <SetupStep
            step="1"
            title="Open Default App Settings"
            description="Go to Settings → Apps → Default Apps → Browser App"
          />
          <View style={styles.stepDivider} />
          <SetupStep
            step="2"
            title="Select AEGIS"
            description="Choose AEGIS as your default browser to intercept all HTTP/HTTPS links"
          />
          <View style={styles.stepDivider} />
          <SetupStep
            step="3"
            title="Click any link"
            description="Open a link from WhatsApp, Gmail, SMS, or any app — AEGIS will analyze it"
          />
          <View style={styles.stepDivider} />
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={openDefaultAppsSettings}
            activeOpacity={0.75}
          >
            <Text style={styles.settingsButtonText}>Open App Settings →</Text>
          </TouchableOpacity>
        </GlassCard>
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(tabs)/blocked')}
            activeOpacity={0.75}
          >
            <Text style={styles.actionIcon}><Shield color={"#ffffff"} width={"24px"} height={"24px"}/></Text>
            <Text style={styles.actionTitle}>Blocked URLs</Text>
            <Text style={styles.actionSubtitle}>{blockedCount} entries</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/url-analysis?url=https://example.com')}
            activeOpacity={0.75}
          >
            <Text style={styles.actionIcon}><Search color={"#ffffff"} width={"24px"} height={"24px"}/></Text>
            <Text style={styles.actionTitle}>Test Analysis</Text>
            <Text style={styles.actionSubtitle}>Try a scan</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* How it works */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>How It Works</Text>
        <GlassCard>
          <Text style={styles.flowText}>
            {'Click Link → Android opens AEGIS → ML analysis  → Result shown → You decide: Open / Block / Cancel'}
          </Text>
        </GlassCard>
      </View>

      {/* <GlassCard style={[styles.warningCard, { borderColor: Colors.accentYellowBorder }]}>
        <Text style={styles.warningTitle}>⚠ Important Note</Text>
        <Text style={styles.warningText}>
          AEGIS requires an active connection to the prediction backend. Ensure the FastAPI service is running and reachable from your device.
        </Text>
      </GlassCard> */}
    </ScrollView>
  );
}

function SetupStep({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <View style={styles.stepRow}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepNumber}>{step}</Text>
      </View>
      <View style={styles.stepContent}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDesc}>{description}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  content: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
  },

  // Hero
  hero: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    gap: Spacing.sm,
  },
  logoContainer: {
    width: 72,
    height: 72,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  logoShield: {
    fontSize: 72,
    color: Colors.accentTeal,
    lineHeight: 80,
  },
  logoInner: {
    position: 'absolute',
    fontSize: 28,
    fontWeight: '900',
    color: Colors.bgPrimary,
  },
  appName: {
    fontSize: 32,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
    letterSpacing: 6,
  },
  tagline: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 20,
  },

  // Status
  statusCard: {
    gap: Spacing.xs,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusActive: {
    backgroundColor: Colors.accentTeal,
  },
  statusText: {
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.accentTeal,
  },
  statusSubtext: {
    fontSize: Typography.fontSizeXs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: Typography.fontSizeDisplay,
    fontWeight: Typography.fontWeightBold,
    color: Colors.accentRed,
  },
  statLabel: {
    fontSize: Typography.fontSizeXs,
    color: Colors.textMuted,
    marginTop: 2,
    letterSpacing: 0.5,
  },

  // Sections
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: Spacing.xs,
  },

  // Setup steps
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accentTealDim,
    borderWidth: 1,
    borderColor: Colors.accentTealBorder,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepNumber: {
    fontSize: Typography.fontSizeSm,
    fontWeight: Typography.fontWeightBold,
    color: Colors.accentTeal,
  },
  stepContent: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.textPrimary,
  },
  stepDesc: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  stepDivider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.sm,
  },
  settingsButton: {
    backgroundColor: Colors.accentTeal,
    borderRadius: Radius.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  settingsButtonText: {
    color: Colors.bgPrimary,
    fontWeight: Typography.fontWeightBold,
    fontSize: Typography.fontSizeMd,
  },

  // Actions grid
  actionsGrid: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  actionCard: {
    flex: 1,
    backgroundColor: Colors.bgGlass,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.bgBorder,
    padding: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  actionIcon: {
    fontSize: 28,
  },
  actionTitle: {
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  actionSubtitle: {
    fontSize: Typography.fontSizeXs,
    color: Colors.textMuted,
  },

  // Flow
  flowText: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    lineHeight: 22,
    textAlign: 'center',
  },

  // Warning
  warningCard: {
    gap: Spacing.xs,
    borderWidth: 1,
  },
  warningTitle: {
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.accentYellow,
  },
  warningText: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
