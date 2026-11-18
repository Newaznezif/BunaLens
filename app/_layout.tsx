import '../global.css';
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { StationProvider } from '@/contexts/StationContext';
import { OfflineQueueProvider } from '@/contexts/OfflineQueueContext';
import AuthGate from '@/components/AuthGate';

export default function RootLayout() {
  return (
    <LanguageProvider>
      <StationProvider>
        <OfflineQueueProvider>
          <AuthGate>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#FAF8F5' } }}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="batch/[id]" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="settings" />
            </Stack>
          </AuthGate>
        </OfflineQueueProvider>
      </StationProvider>
    </LanguageProvider>
  );
}
