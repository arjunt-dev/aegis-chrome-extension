/**
 * AEGIS Blocked URLs Screen
 * Lists and manages all blocked URLs with unblock/clear actions
 */

import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { GlassCard } from '@/components/GlassCard';
import { PredictionBadge } from '@/components/PredictionBadge';
import { Header } from '@/components/Header';
import { useBlocklist } from '@/context/BlocklistContext';
import { Colors, Spacing, Typography, Radius } from '@/constants/theme';
import { formatTimestamp, truncateUrl } from '@/utils/url';
import {Shield} from 'lucide-react-native';
import type { BlockedUrl, PredictionLabel } from '@/types';

export default function BlockedUrlsScreen() {
  const insets = useSafeAreaInsets();
  const { blockedUrls, blockedCount, removeBlockedUrl, clearAll, refresh, isLoading } = useBlocklist();
  const [removingUrl, setRemovingUrl] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh])
  );

  const handleRemove = (entry: BlockedUrl) => {
    Alert.alert(
      'Unblock URL',
      `Remove ${entry.domain} from blocklist?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unblock',
          style: 'destructive',
          onPress: async () => {
            setRemovingUrl(entry.url);
            try {
              await removeBlockedUrl(entry.url);
            } finally {
              setRemovingUrl(null);
            }
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    if (blockedCount === 0) return;
    Alert.alert(
      'Clear All Blocked URLs',
      'This will permanently remove all entries from your blocklist. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: clearAll,
        },
      ]
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <Header
        title="Blocked URLs"
        subtitle={`${blockedCount} ENTRIES`}
        rightElement={
          blockedCount > 0 ? (
            <TouchableOpacity onPress={handleClearAll} activeOpacity={0.7} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>Clear All</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.xl },
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
        {blockedCount === 0 ? (
          <EmptyState />
        ) : (
          <>
            <GlassCard style={[styles.summaryCard, { borderColor: Colors.accentRedBorder }]}>
              <Text style={styles.summaryIcon}><Shield color={"#ffffff"} width={"24px"} height={"24px"}/></Text>
              <View>
                <Text style={styles.summaryTitle}>{blockedCount} URLs Blocked</Text>
                <Text style={styles.summarySubtitle}>
                  These URLs are automatically blocked when clicked
                </Text>
              </View>
            </GlassCard>

            {blockedUrls.map((entry) => (
              <BlockedUrlCard
                key={entry.url}
                entry={entry}
                isRemoving={removingUrl === entry.url}
                onRemove={() => handleRemove(entry)}
              />
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}

function BlockedUrlCard({
  entry,
  isRemoving,
  onRemove,
}: Readonly<{
  entry: BlockedUrl;
  isRemoving: boolean;
  onRemove: () => void;
}>) {
  return (
    <GlassCard style={styles.entryCard}>
      {/* Header row */}
      <View style={styles.entryHeader}>
        <View style={styles.entryDomainRow}>
          <View style={styles.blockedDot} />
          <Text style={styles.entryDomain} numberOfLines={1}>{entry.domain}</Text>
        </View>
        {entry.prediction && (
          <PredictionBadge prediction={entry.prediction as PredictionLabel} size="sm" />
        )}
      </View>

      {/* URL */}
      <Text style={styles.entryUrl} numberOfLines={2}>
        {truncateUrl(entry.url, 70)}
      </Text>

      {/* Footer row */}
      <View style={styles.entryFooter}>
        <Text style={styles.entryTimestamp}>
          Blocked {formatTimestamp(entry.blockedAt)}
        </Text>
        <TouchableOpacity
          onPress={onRemove}
          disabled={isRemoving}
          style={styles.unblockBtn}
          activeOpacity={0.75}
        >
          <Text style={styles.unblockBtnText}>{isRemoving ? 'Removing...' : 'Unblock'}</Text>
        </TouchableOpacity>
      </View>
    </GlassCard>
  );
}

function EmptyState() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyIcon}><Shield color={"#ffffff"} width={"24px"} height={"24px"}/></Text>
      <Text style={styles.emptyTitle}>No Blocked URLs</Text>
      <Text style={styles.emptySubtitle}>
        URLs you block during analysis will appear here. Open a link from any app to get started.
      </Text>
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
    gap: Spacing.sm,
    paddingTop: Spacing.xs,
  },

  // Header elements
  clearBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.accentRedDim,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.accentRedBorder,
  },
  clearBtnText: {
    fontSize: Typography.fontSizeSm,
    color: Colors.accentRed,
    fontWeight: Typography.fontWeightSemibold,
  },

  // Summary card
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderWidth: 1,
  },
  summaryIcon: {
    fontSize: 28,
  },
  summaryTitle: {
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
  },
  summarySubtitle: {
    fontSize: Typography.fontSizeXs,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // Entry cards
  entryCard: {
    gap: Spacing.sm,
  },
  entryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  entryDomainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    flex: 1,
    marginRight: Spacing.sm,
  },
  blockedDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.accentRed,
    flexShrink: 0,
  },
  entryDomain: {
    fontSize: Typography.fontSizeMd,
    fontWeight: Typography.fontWeightSemibold,
    color: Colors.textPrimary,
    flex: 1,
  },
  entryUrl: {
    fontSize: Typography.fontSizeXs,
    color: Colors.textSecondary,
    lineHeight: 18,
  },
  entryFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entryTimestamp: {
    fontSize: Typography.fontSizeXs,
    color: Colors.textMuted,
  },
  unblockBtn: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: Radius.sm,
    backgroundColor: Colors.accentTealDim,
    borderWidth: 1,
    borderColor: Colors.accentTealBorder,
  },
  unblockBtnText: {
    fontSize: Typography.fontSizeXs,
    color: Colors.accentTeal,
    fontWeight: Typography.fontWeightSemibold,
  },

  // Empty state
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 56,
  },
  emptyTitle: {
    fontSize: Typography.fontSizeXl,
    fontWeight: Typography.fontWeightBold,
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: Typography.fontSizeSm,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
