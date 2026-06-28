/**
 * AEGIS Tabs Layout
 * Bottom tab navigation: Home + Blocked URLs
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Typography } from '@/constants/theme';
import { Home, Shield } from 'lucide-react-native';

interface TabIconProps {
  icon: React.ReactNode;
  label: string;
  focused: boolean;
}

function TabIcon({ icon, label, focused }: TabIconProps) {
  return (
    <View style={styles.tabItem}>
      <Text style={[styles.tabIconText, focused && styles.tabIconActive]}>{icon}</Text>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: Colors.bgSecondary,
          borderTopColor: Colors.bgBorder,
          borderTopWidth: 1,
          height: 70,
          paddingBottom: 8,
          elevation: 0,
        },
        tabBarShowLabel: false,
        tabBarActiveTintColor: Colors.accentTeal,
        tabBarInactiveTintColor: Colors.textMuted,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={<Home color={"#ffffff"} width={"24px"} height={"24px"}/>} label="Home" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="blocked"
        options={{
          title: 'Blocked',
          tabBarIcon: ({ focused }) => (
            <TabIcon icon={<Shield color={"#ffffff"} width={"24px"} height={"24px"}/>} label="Blocked" focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabItem: {
    alignItems: 'center',
    gap: 3,
    paddingTop: 6,
    width: 60,
  },
  tabIconText: {
    fontSize: 22,
    opacity: 0.5,
  },
  tabIconActive: {
    opacity: 1,
  },
  tabLabel: {
    fontSize: Typography.fontSizeXs,
    color: Colors.textMuted,
    fontWeight: Typography.fontWeightMedium,
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: Colors.accentTeal,
    fontWeight: Typography.fontWeightSemibold,
  },
});
