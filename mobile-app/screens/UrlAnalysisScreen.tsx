/**
 * AEGIS URL Analysis Screen
 * Intercepts URL, analyzes it, shows results and user action buttons
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Linking,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { GlassCard } from '@/components/GlassCard';
import { PredictionBadge } from '@/components/PredictionBadge';
import { ConfidenceMeter } from '@/components/ConfidenceMeter';
import { ActionButton } from '@/components/ActionButton';
import { UrlInfoCard } from '@/components/UrlInfoCard';
import { Header } from '@/components/Header';
import { useUrlAnalysis } from '@/hooks/useUrlAnalysis';
import { useBlocklist } from '@/context/BlocklistContext';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import { formatTimestamp, isValidUrl, extractDomain } from '@/utils/url';
import type { PredictionLabel } from '@/types';
import { Ban, Check, FishingHook, TriangleAlert } from 'lucide-react-native';

export default function UrlAnalysisScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ url?: string }>();
  const { result, status, errorMessage, analyze } = useUrlAnalysis();
  const { addBlockedUrl, isUrlBlocked } = useBlocklist();
  const [isBlocked, setIsBlocked] = useState(false);
  const [isBlockingInProgress, setIsBlockingInProgress] = useState(false);
  const [hasCheckedBlocklist, setHasCheckedBlocklist] = useState(false);

  const url = params.url ? decodeURIComponent(params.url) : '';
  const domain = extractDomain(url);

  const checkAndAnalyze = useCallback(async () => {
    if (!url) return;

    // Check blocklist first
    const blocked = await isUrlBlocked(url);
    setIsBlocked(blocked);
    setHasCheckedBlocklist(true);

    if (!blocked && isValidUrl(url)) {
      await analyze(url);
    }
  }, [url, isUrlBlocked, analyze]);

  useEffect(() => {
    checkAndAnalyze();
  }, [checkAndAnalyze]);

  const handleOpenUrl = async () => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        router.back();
      } else {
        Alert.alert('Cannot Open URL', 'No app found to handle this URL.');
      }
    } catch {
      Alert.alert('Error', 'Failed to open the URL.');
    }
  };

  const handleBlockUrl = async () => {
    setIsBlockingInProgress(true);
    try {
      await addBlockedUrl({
        url,
        domain,
        blockedAt: Date.now(),
        prediction: result?.prediction,
        confidence: result?.confidence,
      });
      setIsBlocked(true);
      Alert.alert('URL Blocked', `${domain} has been added to your blocklist.`);
    } catch {
      Alert.alert('Error', 'Failed to block URL.');
    } finally {
      setIsBlockingInProgress(false);
    }
  };

  const handleOverrideBlock = () => {
    Alert.alert(
      'Override Block',
      'This URL is in your blocklist. Are you sure you want to open it?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Open Anyway',
          style: 'destructive',
          onPress: handleOpenUrl,
        },
      ]
    );
  };

  const handleCancel = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  // ─── Invalid URL ────────────────────────────────────────────────────────────
  if (!url || !isValidUrl(url)) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header title="URL Analysis" showBack onBack={handleCancel} />
        <View style={styles.centerContent}>
          <Text style={styles.bigIcon}><TriangleAlert color="#ffff00" width="24px" height="24px" /></Text>
          <Text style={styles.stateTitle}>Invalid URL</Text>
          <Text style={styles.stateSubtitle}>
            {url ? `"${url}" is not a valid HTTP/HTTPS URL.` : 'No URL was provided.'}
          </Text>
          <ActionButton label="Go Back" onPress={handleCancel} variant="ghost" style={{ marginTop: Spacing.sm }} />
        </View>
      </View>
    );
  }

  // ─── Loading ─────────────────────────────────────────────────────────────────
  if (!hasCheckedBlocklist || status === 'loading') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header title="Analyzing URL" showBack onBack={handleCancel} />
        <View style={styles.centerContent}>
          <View style={styles.loadingRing}>
            <ActivityIndicator size="large" color={Colors.accentTeal} />
          </View>
          <Text style={styles.stateTitle}>Scanning URL</Text>
          <Text style={styles.domainHighlight}>{domain}</Text>
          <Text style={styles.stateSubtitle}>
            Checking blocklist and running phishing analysis...
          </Text>
        </View>
      </View>
    );
  }

  // ─── Blocked URL ─────────────────────────────────────────────────────────────
  if (isBlocked) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header title="Blocked URL" subtitle="AEGIS SHIELD" showBack onBack={handleCancel} />
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
        >
          <View style={[styles.resultBanner, { borderColor: Colors.accentRedBorder, backgroundColor: Colors.accentRedDim }]}>
            <Text style={styles.bigIcon}><Ban color="#ff0000" width="24px" height="24px" /></Text>
            <Text style={[styles.bannerTitle, { color: Colors.accentRed }]}>BLOCKED</Text>
            <Text style={styles.bannerSubtitle}>This URL is in your blocklist</Text>
          </View>

          <UrlInfoCard url={url} domain={domain} />

          <GlassCard style={[styles.infoCard, { borderColor: Colors.accentRedBorder }]}>
            <Text style={styles.infoCardTitle}>Why is this blocked?</Text>
            <Text style={styles.infoCardText}>
              You previously added this URL to your AEGIS blocklist. Opening it is not recommended.
            </Text>
          </GlassCard>

          <View style={styles.actionsColumn}>
            <ActionButton
              label="Open Anyway (Override)"
              onPress={handleOverrideBlock}
              variant="warning"
              fullWidth
            />
            <ActionButton label="Cancel" onPress={handleCancel} variant="ghost" fullWidth />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Error ───────────────────────────────────────────────────────────────────
  if (status === 'error') {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header title="Analysis Failed" showBack onBack={handleCancel} />
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
        >
          <View style={[styles.resultBanner, { borderColor: Colors.accentRedBorder, backgroundColor: Colors.accentRedDim }]}>
            <Text style={styles.bigIcon}><TriangleAlert color="#ff0000" width="24px" height="24px" /></Text>
            <Text style={[styles.bannerTitle, { color: Colors.accentRed }]}>API ERROR</Text>
            <Text style={styles.bannerSubtitle}>{errorMessage}</Text>
          </View>

          <UrlInfoCard url={url} domain={domain} />

          <GlassCard style={[styles.infoCard, { borderColor: Colors.accentYellowBorder }]}>
            <Text style={[styles.infoCardTitle, { color: Colors.accentYellow }]}><TriangleAlert color={Colors.accentYellow} width="24px" height="24px" /> Unable to Verify Safety</Text>
            <Text style={styles.infoCardText}>
              The phishing detection backend could not be reached. Proceed with extreme caution or cancel.
            </Text>
          </GlassCard>

          <View style={styles.actionsColumn}>
            <ActionButton
              label="Retry Analysis"
              onPress={() => analyze(url)}
              variant="primary"
              fullWidth
            />
            <ActionButton
              label="Open URL Anyway"
              onPress={handleOpenUrl}
              variant="warning"
              fullWidth
            />
            <ActionButton label="Cancel" onPress={handleCancel} variant="ghost" fullWidth />
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Success ─────────────────────────────────────────────────────────────────
  if (status === 'success' && result) {
    const { prediction, confidence } = result;
    const pred = prediction as PredictionLabel;
    const isPhishing = pred === 'phishing';
    const isSuspicious = pred === 'suspicious';
    const isSafe = pred === 'safe';

    const bannerBgColor = isPhishing
      ? Colors.accentRedDim
      : isSuspicious
      ? Colors.accentYellowDim
      : Colors.accentTealDim;

    const bannerBorderColor = isPhishing
      ? Colors.accentRedBorder
      : isSuspicious
      ? Colors.accentYellowBorder
      : Colors.accentTealBorder;

    const bannerIcon = isPhishing ? <FishingHook color={Colors.accentRed} width="24px" height="24px" /> : isSuspicious ? <TriangleAlert color={Colors.accentYellow} width="24px" height="24px" /> : <Check color={Colors.accentTeal} width="24px" height="24px" />;

    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <Header title="Analysis Result" subtitle="AEGIS SHIELD" showBack onBack={handleCancel} />
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
        >
          {/* Result Banner */}
          <View style={[styles.resultBanner, { backgroundColor: bannerBgColor, borderColor: bannerBorderColor }]}>
            <Text style={styles.bigIcon}>{bannerIcon}</Text>
            <PredictionBadge prediction={pred} size="lg"  />
            <Text style={styles.bannerSubtitle}>
              {isPhishing
                ? 'This URL shows strong signs of phishing activity'
                : isSuspicious
                ? 'This URL has suspicious characteristics'
                : 'This URL appears to be safe'}
            </Text>
          </View>

          <UrlInfoCard url={url} domain={domain} />

          {/* Confidence */}
          <GlassCard>
            <ConfidenceMeter confidence={confidence} prediction={pred} />
          </GlassCard>

          {/* Details */}
          <GlassCard style={styles.detailsCard}>
            <Text style={styles.sectionLabel}>Analysis Details</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Scanned At</Text>
              <Text style={styles.detailValue}>{formatTimestamp(result.timestamp)}</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Confidence Score</Text>
              <Text style={styles.detailValue}>{(confidence * 100).toFixed(1)}%</Text>
            </View>
            <View style={styles.detailDivider} />
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Prediction</Text>
              <PredictionBadge prediction={pred} size="sm" />
            </View>
          </GlassCard>

          {/* Advisory for non-safe */}
          {!isSafe && (
            <GlassCard
              style={[
                styles.advisoryCard,
                { borderColor: isPhishing ? Colors.accentRedBorder : Colors.accentYellowBorder },
              ]}
            >
              <Text
                style={[
                  styles.advisoryTitle,
                  { color: isPhishing ? Colors.accentRed : Colors.accentYellow },
                ]}
              >
                {isPhishing ? '🔴 High Risk — Do Not Open' : '🟡 Caution Advised'}
              </Text>
              <Text style={styles.advisoryText}>
                {isPhishing
                  ? 'This URL is likely a phishing attempt. Avoid entering credentials, personal, or financial information.'
                  : 'This URL has some suspicious traits. Proceed with caution and avoid sharing sensitive data.'}
              </Text>
            </GlassCard>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsColumn}>
            {!isPhishing && (
              <ActionButton
                label="Open URL"
                onPress={handleOpenUrl}
                variant={isSafe ? 'primary' : 'warning'}
                fullWidth
              />
            )}
            <ActionButton
              label={isBlocked ? 'Already Blocked' : 'Block URL'}
              onPress={handleBlockUrl}
              variant="danger"
              loading={isBlockingInProgress}
              disabled={isBlocked}
              fullWidth
            />
            <ActionButton label="Cancel" onPress={handleCancel} variant="ghost" fullWidth />

            {/* Danger override for phishing */}
            {isPhishing && (
              <TouchableOpacity onPress={handleOpenUrl} style={styles.dangerOverride} activeOpacity={0.7}>
                <Text style={styles.dangerOverrideText}>Open anyway (not recommended)</Text>
              </TouchableOpacity>
            )}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ─── Fallback ─────────────────────────────────────────────────────────────────
  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header title="URL Analysis" showBack onBack={handleCancel} />
      <View style={styles.centerContent}>
        <ActivityIndicator color={Colors.accentTeal} size="large" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgPrimary,
  },
  scrollContent: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.md,
    paddingTop: Spacing.sm,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },

  // Reusable state elements
  bigIcon: {
    fontSize: 44,
  },
  stateTitle: {
    fontSize: Typography.fontSizeXl,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  stateSubtitle: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  domainHighlight: {
    fontSize: Typography.fontSizeMd,
    color: Colors.accentTeal,
    fontWeight: Typography.fontWeightSemibold,
  },

  // Loading ring
  loadingRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accentTealDim,
    borderWidth: 2,
    borderColor: Colors.accentTealBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Result banner
  resultBanner: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bannerTitle: {
    fontSize: Typography.fontSizeDisplay,
    fontWeight: Typography.fontWeightBold,
    letterSpacing: 4,
  },
  bannerSubtitle: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },

  // Info cards
  infoCard: {
    gap: Spacing.xs,
    borderWidth: 1,
  },
  infoCardTitle: {
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.textPrimary,
  },
  infoCardText: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Details card
  detailsCard: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: Typography.fontSizeXs,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.textMuted,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: Spacing.xs,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
  },
  detailValue: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textPrimary,
    fontWeight: Typography.fontWeightMedium,
  },
  detailDivider: {
    height: 1,
    backgroundColor: Colors.divider,
  },

  // Advisory
  advisoryCard: {
    gap: Spacing.xs,
    borderWidth: 1,
  },
  advisoryTitle: {
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightBold,
  },
  advisoryText: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Action buttons
  actionsColumn: {
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },
  dangerOverride: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  dangerOverrideText: {
    fontSize: Typography.fontSizeXs,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
});
