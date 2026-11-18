import React, { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { JIMMA_WOREDAS } from '@/constants/jimmaData';
import { useLanguage } from '@/contexts/LanguageContext';
import LanguageToggle from '@/components/LanguageToggle';
import { useStation } from '@/contexts/StationContext';
import { isSupabaseConfigured, supabase } from '@/services/supabaseClient';
import { showAlert } from '@/services/platformAlert';

export default function AuthScreen() {
  const { station, setStation } = useStation();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState(station.name);
  const [manager, setManager] = useState(station.manager);
  const [woreda, setWoreda] = useState(station.woreda);
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    if (!supabase) {
      showAlert(t('cloudUnavailable'), t('cloudUnavailableHint'));
      return;
    }
    if (!email.trim() || password.length < 8) {
      showAlert(t('checkCredentials'), t('checkCredentials'));
      return;
    }

    setBusy(true);
    try {
      const result = mode === 'signin'
        ? await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
        : await supabase.auth.signUp({
            email: email.trim().toLowerCase(),
            password,
            options: {
              data: {
                full_name: manager.trim(),
                station_name: name.trim(),
                station_woreda: woreda,
              },
            },
          });

      if (result.error) throw result.error;
      const user = result.data.user;
      const session = result.data.session;

      if (!user) throw new Error('The authentication provider did not return a user.');
      if (!session) {
        showAlert(t('confirmEmail'), t('accountCreated'));
        return;
      }

      // Keep station details local for this first authentication milestone.
      // Cloud station creation will be added after the Supabase schema and RLS are configured.
      const metadata = user.user_metadata ?? {};
      setStation({
        ...station,
        name: mode === 'signup' ? (name.trim() || 'My Coffee Station') : (metadata.station_name || station.name),
        manager: mode === 'signup' ? (manager.trim() || user.email || 'Station Manager') : (metadata.full_name || station.manager),
        woreda: mode === 'signup' ? woreda : (metadata.station_woreda || station.woreda),
      });

      router.replace('/(tabs)');
    } catch (error) {
      showAlert(t('accountError'), error instanceof Error ? error.message : t('accountError'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView className="flex-1 bg-parchment p-6" keyboardShouldPersistTaps="handled">
      <View className="flex-row justify-end mt-8"><LanguageToggle /></View>
      <Text className="text-espresso text-3xl font-black mt-5">{t('accountTitle')}</Text>
      <Text className="text-stone-500 mt-2">{t('accountHint')}</Text>

      {!isSupabaseConfigured ? (
        <View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-5">
          <Text className="text-amber-900 text-sm">{t('cloudUnavailableHint')}</Text>
        </View>
      ) : null}

      <View className="bg-white rounded-2xl p-4 mt-6 border border-line">
        <View className="flex-row gap-2">
          <Pressable onPress={() => setMode('signin')} accessibilityRole="tab" accessibilityState={{ selected: mode === 'signin' }} className={`flex-1 p-3 rounded-lg ${mode === 'signin' ? 'bg-espresso' : 'bg-parchment'}`}>
            <Text className={mode === 'signin' ? 'text-white text-center font-bold' : 'text-espresso text-center'}>{t('signIn')}</Text>
          </Pressable>
          <Pressable onPress={() => setMode('signup')} accessibilityRole="tab" accessibilityState={{ selected: mode === 'signup' }} className={`flex-1 p-3 rounded-lg ${mode === 'signup' ? 'bg-espresso' : 'bg-parchment'}`}>
            <Text className={mode === 'signup' ? 'text-white text-center font-bold' : 'text-espresso text-center'}>{t('createAccount')}</Text>
          </Pressable>
        </View>

        <Text className="text-espresso font-bold mt-5">{t('email')}</Text>
        <TextInput
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          placeholder="you@example.com"
          className="border border-line rounded-xl p-3 mt-2 text-espresso"
        />

        <Text className="text-espresso font-bold mt-4">{t('password')}</Text>
        <TextInput
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          textContentType={mode === 'signin' ? 'password' : 'newPassword'}
          placeholder="At least 8 characters"
          className="border border-line rounded-xl p-3 mt-2 text-espresso"
        />

        {mode === 'signup' ? (
          <>
            <Text className="text-espresso font-bold mt-4">{t('stationName')}</Text>
            <TextInput value={name} onChangeText={setName} className="border border-line rounded-xl p-3 mt-2 text-espresso" />
            <Text className="text-espresso font-bold mt-4">{t('manager')}</Text>
            <TextInput value={manager} onChangeText={setManager} className="border border-line rounded-xl p-3 mt-2 text-espresso" />
            <Text className="text-espresso font-bold mt-4">{t('stationWoreda')}</Text>
            <View className="flex-row flex-wrap mt-2">
              {JIMMA_WOREDAS.map((item) => (
                <Pressable key={item} onPress={() => setWoreda(item)} className={`p-2 m-1 rounded-full ${item === woreda ? 'bg-espresso' : 'bg-parchment'}`}>
                  <Text className={item === woreda ? 'text-white' : 'text-espresso'}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <Pressable
          disabled={busy || !isSupabaseConfigured}
          onPress={connect}
          accessibilityRole="button"
          className={`p-4 rounded-xl mt-6 ${busy || !isSupabaseConfigured ? 'bg-stone-400' : 'bg-cherry'}`}
        >
          {busy
            ? <ActivityIndicator color="white" />
            : <Text className="text-white text-center font-bold">{mode === 'signin' ? t('signInConnect') : t('createAccountStation')}</Text>}
        </Pressable>
      </View>
    </ScrollView>
  );
}
