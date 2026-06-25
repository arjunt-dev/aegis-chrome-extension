/**
 * AEGIS Root Layout
 * Sets up providers and URL interception handler
 */

import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { BlocklistProvider } from '@/context/BlocklistContext';
import { useIncomingUrl } from '@/hooks/useIncomingUrl';
import { Colors } from '@/constants/theme';
import 'react-native-reanimated';

SplashScreen.preventAutoHideAsync();

function AppContent() {
  useIncomingUrl(); // Intercept all incoming URLs from Android intents

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.bgPrimary },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen
        name="url-analysis"
        options={{
          headerShown: false,
          animation: 'slide_from_bottom',
          presentation: 'modal',
        }}
      />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: Colors.bgPrimary }}>
      <SafeAreaProvider>
        <BlocklistProvider>
          <StatusBar style="light" backgroundColor={Colors.bgPrimary} />
          <AppContent />
        </BlocklistProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
