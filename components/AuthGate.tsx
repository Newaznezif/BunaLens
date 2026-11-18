import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { supabase } from '@/services/supabaseClient';
import { BunaLensTheme as theme } from '@/constants/theme';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    if (!supabase) {
      setAuthenticated(false);
      setReady(true);
      return () => { active = false; };
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAuthenticated(Boolean(session));
      setReady(true);
    });

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!active) return;
        setAuthenticated(!error && Boolean(data.session));
        setReady(true);
      })
      .catch(() => {
        if (active) {
          setAuthenticated(false);
          setReady(true);
        }
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const isAuthRoute = segments[0] === 'auth';

  useEffect(() => {
    if (!ready) return;
    if (!authenticated && !isAuthRoute) router.replace('/auth');
    if (authenticated && isAuthRoute) router.replace('/(tabs)');
  }, [authenticated, isAuthRoute, ready, router]);

  if (!ready || (!authenticated && !isAuthRoute) || (authenticated && isAuthRoute)) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.parchment }}>
        <ActivityIndicator size="large" color={theme.colors.emerald} />
      </View>
    );
  }

  return <>{children}</>;
}
