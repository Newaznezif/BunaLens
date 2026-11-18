import '../global.css';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { StationProvider } from '@/contexts/StationContext';
import { OfflineQueueProvider } from '@/contexts/OfflineQueueContext';
import { isSupabaseConfigured, supabase } from '@/services/supabaseClient';

type AuthStatus = 'checking' | 'authenticated' | 'unauthenticated';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking');

  // Restore the persisted Supabase session before exposing any application route.
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      setAuthStatus('unauthenticated');
      return;
    }

    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setAuthStatus(session ? 'authenticated' : 'unauthenticated');
    });

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (active) setAuthStatus(!error && data.session ? 'authenticated' : 'unauthenticated');
      })
      .catch(() => {
        if (active) setAuthStatus('unauthenticated');
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Protect every application route. The auth screen remains reachable without a session.
  useEffect(() => {
    if (authStatus === 'checking') return;

    const onAuthScreen = segments[0] === 'auth';
    if (authStatus === 'unauthenticated' && !onAuthScreen) {
      router.replace('/auth');
    } else if (authStatus === 'authenticated' && onAuthScreen) {
      router.replace('/(tabs)');
    }
  }, [authStatus, segments, router]);

  const onAuthScreen = segments[0] === 'auth';
  const redirecting =
    authStatus === 'checking' ||
    (authStatus === 'unauthenticated' && !onAuthScreen) ||
    (authStatus === 'authenticated' && onAuthScreen);

  return (
    <LanguageProvider>
      <StationProvider>
        <OfflineQueueProvider>
          <View style={{ flex: 1, backgroundColor: '#FAF8F5' }}>
            <StatusBar style="dark" />
            <Stack
              initialRouteName="auth"
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: '#FAF8F5' },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="batch/[id]" />
              <Stack.Screen name="auth" />
              <Stack.Screen name="settings" />
            </Stack>

            {redirecting ? (
              <View
                accessibilityRole="progressbar"
                accessibilityLabel="Checking your sign-in status"
                style={{
                  position: 'absolute',
                  top: 0,
                  right: 0,
                  bottom: 0,
                  left: 0,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#FAF8F5',
                }}
              >
                <ActivityIndicator size="large" color="#55765D" />
                <Text style={{ color: '#26372D', marginTop: 12, fontSize: 13, fontWeight: '600' }}>
                  Checking your account…
                </Text>
              </View>
            ) : null}
          </View>
        </OfflineQueueProvider>
      </StationProvider>
    </LanguageProvider>
  );
}
