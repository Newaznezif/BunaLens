import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { CheckCircle2, CloudOff, LogOut, ArrowLeft } from 'lucide-react-native';
import { JIMMA_WOREDAS } from '@/constants/jimmaData';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageToggle from '@/components/LanguageToggle';
import { useStation } from '@/contexts/StationContext';
import { useOfflineQueue } from '@/contexts/OfflineQueueContext';
import { isSupabaseConfigured, supabase } from '@/services/supabaseClient';
import { assignQueuedStation } from '@/services/offlineQueue';
import { showAlert } from '@/services/platformAlert';
import { BunaLensTheme as theme } from '@/constants/theme';

export default function AuthScreen() {
  const { station, setStation, refreshCloudBatches } = useStation();
  const { refresh: refreshQueue } = useOfflineQueue();
  const { t, language } = useLanguage();
  const isOromo = language === 'om';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(station.id !== 'station-demo' ? station.name : 'Gomma Washing Station');
  const [manager, setManager] = useState(station.id !== 'station-demo' ? station.manager : '');
  const [woreda, setWoreda] = useState(station.woreda);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);

  const isConnected = station.id !== 'station-demo';

  const connect = async () => {
    if (!supabase || !isSupabaseConfigured) {
      showAlert(t('cloudUnavailable'), t('cloudUnavailableHint'));
      return;
    }
    if (!email.trim() || password.length < 8) {
      showAlert(t('checkCredentials'), isOromo ? 'Imeelii sirrii fi jecha iccitii yoo xiqqaate qubee 8 qabu galchaa.' : 'Enter a valid email and a password with at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const result = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: { data: { full_name: manager.trim() || undefined } },
          });

      if (result.error) throw result.error;

      const user = result.data.user;
      const session = result.data.session;
      if (!user) {
        showAlert(t('confirmEmail'), t('accountCreated'));
        return;
      }
      if (!session && mode === 'signup') {
        showAlert(t('confirmEmail'), t('accountCreated'));
        return;
      }

      // Look up existing station or create new registered station
      const { data: existing, error: lookupError } = await supabase
        .from('stations')
        .select('id, name, manager, woreda, credits, pro_expires_at, phone, email')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle();

      if (lookupError) throw lookupError;

      let record = existing;
      if (!record) {
        const { data: created, error: createError } = await supabase
          .from('stations')
          .insert({
            owner_id: user.id,
            name: name.trim() || 'My Coffee Station',
            manager: manager.trim() || user.email || 'Station Manager',
            woreda,
          })
          .select('id, name, manager, woreda, credits, pro_expires_at, phone, email')
          .single();

        if (createError) throw createError;
        record = created;
      }

      const connectedStation = {
        id: record.id,
        name: record.name,
        manager: record.manager || 'Station Manager',
        woreda: record.woreda,
        credits: Number(record.credits || 0),
        feresula_price_etb: station.feresula_price_etb,
        pro_expires_at: record.pro_expires_at || undefined,
        contact_phone: record.phone || undefined,
        contact_email: record.email || undefined,
      };

      setStation(connectedStation);
      await assignQueuedStation(record.id);
      await refreshQueue();
      await refreshCloudBatches(record.id);

      showAlert(t('stationConnected'), t('stationReady'));
      router.replace('/(tabs)/station');
    } catch (e) {
      showAlert(t('accountError'), e instanceof Error ? e.message : t('accountError'));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        showAlert('Sign out failed', error.message);
      } else {
        setStation({
          id: 'station-demo',
          name: 'Gomma Coffee Washing Station',
          woreda: 'Gomma',
          manager: 'Station Manager',
          credits: 10,
          feresula_price_etb: 6200,
        });
        showAlert(
          isOromo ? 'Ba’uun milkaa’eera' : 'Signed out',
          isOromo ? 'Appiin gara haala fakkeenya naannootti deebi’eera.' : 'The app has returned to local demonstration mode.',
        );
      }
    } catch (e) {
      showAlert(t('accountError'), e instanceof Error ? e.message : t('accountError'));
    }
  };

  return (
    <ScrollView className="flex-1" style={{ backgroundColor: theme.colors.parchment }} contentContainerStyle={{ padding: 22, paddingTop: 40, paddingBottom: 40 }}>
      <View className="flex-row items-center justify-between mb-4">
        <Pressable onPress={() => router.back()} className="flex-row items-center py-2">
          <ArrowLeft size={18} color={theme.colors.espresso} />
          <Text className="text-sm font-bold ml-2" style={{ color: theme.colors.espresso }}>{t('back')}</Text>
        </Pressable>
        <LanguageToggle />
      </View>

      <Text className="text-3xl font-black" style={{ color: theme.colors.espresso }}>{t('accountTitle')}</Text>
      <Text className="text-xs mt-1.5 leading-5" style={{ color: theme.colors.secondary }}>{t('accountHint')}</Text>

      {!isSupabaseConfigured ? (
        <View className="rounded-2xl p-4 mt-5 border" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
          <View className="flex-row items-center mb-2">
            <CloudOff size={18} color="#B45309" />
            <Text className="text-sm font-black ml-2" style={{ color: '#92400E' }}>{t('cloudUnavailable')}</Text>
          </View>
          <Text className="text-xs leading-5" style={{ color: '#92400E' }}>{t('cloudUnavailableHint')}</Text>
          <Pressable onPress={() => router.replace('/(tabs)')} className="rounded-xl p-3 mt-4 items-center" style={{ backgroundColor: theme.colors.espresso }}>
            <Text className="text-white text-xs font-bold">{isOromo ? 'Gara Fula Jalqabaatti Deebi’aa (Fakkeenya)' : 'Continue in Local Demonstration Mode'}</Text>
          </Pressable>
        </View>
      ) : isConnected ? (
        <View className="rounded-3xl p-5 mt-5 border" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.line }}>
          <View className="flex-row items-center mb-3">
            <CheckCircle2 size={20} color={theme.colors.emerald} />
            <Text className="text-sm font-extrabold ml-2" style={{ color: theme.colors.emerald }}>{isOromo ? 'Buufatni Walqabsiifameera' : 'Connected Washing Station'}</Text>
          </View>
          <Text className="text-xl font-black" style={{ color: theme.colors.espresso }}>{station.name}</Text>
          <Text className="text-xs mt-1" style={{ color: theme.colors.secondary }}>{station.woreda} · {station.manager}</Text>
          <Text className="text-xs mt-2" style={{ color: theme.colors.secondary }}>ID: {station.id}</Text>

          <View className="flex-row gap-3 mt-5">
            <Pressable onPress={() => router.replace('/(tabs)/station')} className="flex-1 p-3.5 rounded-xl items-center" style={{ backgroundColor: theme.colors.espresso }}>
              <Text className="text-white font-bold text-xs">{t('manageStation')}</Text>
            </Pressable>
            <Pressable onPress={signOut} className="p-3.5 rounded-xl border flex-row items-center justify-center px-4" style={{ borderColor: '#FECACA', backgroundColor: '#FEF2F2' }}>
              <LogOut size={15} color="#B91C1C" />
              <Text className="text-xs font-bold ml-1.5" style={{ color: '#B91C1C' }}>{t('logout')}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View className="rounded-3xl p-5 mt-5 border" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.line }}>
          <View className="flex-row gap-2 mb-4">
            <Pressable onPress={() => setMode('signin')} className="flex-1 p-3 rounded-xl items-center" style={{ backgroundColor: mode === 'signin' ? theme.colors.espresso : theme.colors.parchment }}>
              <Text className="text-xs font-extrabold" style={{ color: mode === 'signin' ? '#FFFFFF' : theme.colors.espresso }}>{t('signIn')}</Text>
            </Pressable>
            <Pressable onPress={() => setMode('signup')} className="flex-1 p-3 rounded-xl items-center" style={{ backgroundColor: mode === 'signup' ? theme.colors.espresso : theme.colors.parchment }}>
              <Text className="text-xs font-extrabold" style={{ color: mode === 'signup' ? '#FFFFFF' : theme.colors.espresso }}>{t('createAccount')}</Text>
            </Pressable>
          </View>

          <Text className="text-xs font-bold mb-1.5" style={{ color: theme.colors.espresso }}>{t('email')}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            placeholder="manager@station.et"
            placeholderTextColor={theme.colors.muted}
            className="border rounded-xl p-3 mb-4 text-sm"
            style={{ borderColor: theme.colors.line, color: theme.colors.espresso }}
          />

          <Text className="text-xs font-bold mb-1.5" style={{ color: theme.colors.espresso }}>{t('password')}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder={isOromo ? 'Yoo xiqqaate qubee 8' : 'At least 8 characters'}
            placeholderTextColor={theme.colors.muted}
            className="border rounded-xl p-3 mb-4 text-sm"
            style={{ borderColor: theme.colors.line, color: theme.colors.espresso }}
          />

          {mode === 'signup' ? (
            <>
              <Text className="text-xs font-bold mb-1.5" style={{ color: theme.colors.espresso }}>{t('stationName')}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Gomma Coffee Washing Station"
                placeholderTextColor={theme.colors.muted}
                className="border rounded-xl p-3 mb-4 text-sm"
                style={{ borderColor: theme.colors.line, color: theme.colors.espresso }}
              />

              <Text className="text-xs font-bold mb-1.5" style={{ color: theme.colors.espresso }}>{t('manager')}</Text>
              <TextInput
                value={manager}
                onChangeText={setManager}
                placeholder="Station Manager"
                placeholderTextColor={theme.colors.muted}
                className="border rounded-xl p-3 mb-4 text-sm"
                style={{ borderColor: theme.colors.line, color: theme.colors.espresso }}
              />

              <Text className="text-xs font-bold mb-1.5" style={{ color: theme.colors.espresso }}>{t('stationWoreda')}</Text>
              <View className="flex-row flex-wrap mb-4">
                {JIMMA_WOREDAS.map((item) => (
                  <Pressable
                    key={item}
                    onPress={() => setWoreda(item)}
                    className="px-3 py-2 mr-2 mb-2 rounded-full border"
                    style={{
                      backgroundColor: item === woreda ? theme.colors.espresso : theme.colors.parchment,
                      borderColor: item === woreda ? theme.colors.espresso : theme.colors.line,
                    }}
                  >
                    <Text className="text-xs font-bold" style={{ color: item === woreda ? '#FFFFFF' : theme.colors.espresso }}>
                      {item}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}

          <Pressable
            disabled={busy || !isSupabaseConfigured}
            onPress={connect}
            className="p-4 rounded-xl mt-3 items-center"
            style={{ backgroundColor: theme.colors.cherry, opacity: busy ? 0.7 : 1 }}
          >
            {busy ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-extrabold text-sm">
                {mode === 'signin' ? t('signInConnect') : t('createAccountStation')}
              </Text>
            )}
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}
