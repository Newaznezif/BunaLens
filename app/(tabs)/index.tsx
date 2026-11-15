import React, { useMemo } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { ScanLine, TrendingUp, MapPin, ChevronRight, Coffee, ShieldCheck, Clock3, Sparkles, Layers3, Wallet, FlaskConical } from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStation } from '@/contexts/StationContext';
import { BunaLensTheme as theme } from '@/constants/theme';
import LanguageToggle from '@/components/LanguageToggle';
import OfflineBanner from '@/components/OfflineBanner';

function MetricCard({ label, value, detail, icon: Icon, tint }: { label: string; value: string; detail: string; icon: React.ComponentType<any>; tint: string }) {
  return (
    <View className="flex-1 rounded-2xl border p-4" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.line }}>
      <View className="h-9 w-9 rounded-xl items-center justify-center mb-3" style={{ backgroundColor: tint }}><Icon size={18} color={theme.colors.espresso} /></View>
      <Text className="text-xs font-semibold" style={{ color: theme.colors.secondary }}>{label}</Text>
      <Text className="text-2xl font-black mt-1" style={{ color: theme.colors.espresso }}>{value}</Text>
      <Text className="text-[10px] mt-1" style={{ color: theme.colors.secondary }}>{detail}</Text>
    </View>
  );
}

export default function Home() {
  const { t } = useLanguage();
  const { station, batches } = useStation();
  const actual = useMemo(() => batches.filter((b) => b.status === 'synced' && b.result && !b.pricing?.is_demo), [batches]);
  const demos = useMemo(() => batches.filter((b) => b.status === 'demo'), [batches]);
  const avg = actual.length ? Math.round(actual.reduce((sum, b) => sum + b.result.quality_score, 0) / actual.length) : null;
  const actualValue = actual.reduce((sum, b) => sum + (b.pricing?.estimated_lot_value_etb ?? 0), 0);
  const recent = batches.slice(0, 3);
  const currency = (value: number) => value.toLocaleString() + ' ETB';

  return (
    <ScrollView className="flex-1" style={{ backgroundColor: theme.colors.parchment }} contentContainerStyle={{ padding: 20, paddingTop: 18, paddingBottom: 34 }} showsVerticalScrollIndicator={false}>
      <View className="flex-row items-center justify-between mb-6">
        <View className="flex-row items-center">
          <View className="h-11 w-11 rounded-2xl items-center justify-center mr-3" style={{ backgroundColor: theme.colors.espresso }}><Coffee size={23} color="#FFFFFF" /></View>
          <View><Text className="text-xl font-black tracking-tight" style={{ color: theme.colors.espresso }}>BunaLens</Text><Text className="text-[11px] font-medium" style={{ color: theme.colors.secondary }}>{t('coffeeIntelligence')}</Text></View>
        </View>
        <LanguageToggle />
      </View>
      <OfflineBanner />
      <View className="rounded-[26px] p-5 overflow-hidden" style={{ backgroundColor: theme.colors.espresso }}>
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center rounded-full px-3 py-1.5" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
            <MapPin size={12} color="#FDE68A" /><Text className="text-[11px] font-bold ml-1.5" style={{ color: '#F5E9DF' }}>JIMMA ZONE · {station.woreda.toUpperCase()}</Text>
          </View>
          <ShieldCheck size={18} color="#F5E9DF" />
        </View>
        <Text className="text-[11px] font-semibold mt-5" style={{ color: '#C7B6AC' }}>{t('welcomeBack')}</Text>
        <Text className="text-2xl font-black mt-1" style={{ color: '#FFFFFF' }}>{station.name}</Text>
        <View className="flex-row mt-5 pt-4" style={{ borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.16)' }}>
          <View className="flex-1"><Text className="text-[11px] font-semibold" style={{ color: '#C7B6AC' }}>{t('credits')}</Text><Text className="text-3xl font-black mt-1 text-white">{station.credits}</Text><Text className="text-[10px] mt-0.5" style={{ color: '#C7B6AC' }}>{t('availableScans')}</Text></View>
          <View className="w-px mx-4" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }} />
          <View className="flex-1"><Text className="text-[11px] font-semibold" style={{ color: '#C7B6AC' }}>{t('averageQuality')}</Text><Text className="text-3xl font-black mt-1 text-white">{avg === null ? '—' : avg}<Text className="text-base" style={{ color: '#C7B6AC' }}>{avg === null ? '' : '/100'}</Text></Text><Text className="text-[10px] mt-0.5" style={{ color: '#C7B6AC' }}>{actual.length ? t('completedScans') : t('noRealAssessments')}</Text></View>
        </View>
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push('/(tabs)/scan')} className="rounded-2xl p-5 mt-5 flex-row items-center justify-between" style={{ backgroundColor: theme.colors.cherry }}>
        <View className="flex-1 pr-3"><View className="flex-row items-center mb-2"><Sparkles size={14} color="#FEE2E2" /><Text className="text-[11px] font-bold ml-1.5" style={{ color: '#FEE2E2' }}>{t('aiQualityCheck')}</Text></View><Text className="text-xl font-black text-white">{t('scanYourCoffee')}</Text><Text className="text-xs mt-1" style={{ color: '#FEE2E2' }}>{t('captureAssess')}</Text></View>
        <View className="h-12 w-12 rounded-2xl items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.18)' }}><ScanLine size={25} color="#FFFFFF" /></View>
      </Pressable>
      <View className="flex-row items-center justify-between mt-7 mb-3"><Text className="text-lg font-black" style={{ color: theme.colors.espresso }}>{t('stationOverview')}</Text><Text className="text-[11px] font-semibold" style={{ color: theme.colors.secondary }}>{t('yourActivity')}</Text></View>
      <View className="flex-row gap-3">
        <MetricCard label={t('totalSavedBatches')} value={String(batches.length)} detail={t('savedOnDevice')} icon={Layers3} tint="#F5E9DF" />
        <MetricCard label={t('aiAssessments')} value={String(actual.length)} detail={t('completedScans')} icon={TrendingUp} tint="#ECFDF5" />
      </View>
      <View className="rounded-2xl border p-4 mt-3 flex-row items-center" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.line }}>
        <View className="h-10 w-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: '#ECFDF5' }}><Wallet size={19} color={theme.colors.emerald} /></View>
        <View className="flex-1"><Text className="text-xs font-semibold" style={{ color: theme.colors.secondary }}>{t('estimatedCoffeeValue')}</Text><Text className="text-xl font-black mt-1" style={{ color: theme.colors.espresso }}>{actual.length ? currency(actualValue) : '—'}</Text><Text className="text-[10px] mt-1" style={{ color: theme.colors.secondary }}>{t('actualValueOnly')}</Text></View>
      </View>
      {demos.length > 0 ? <View className="rounded-xl px-3 py-2 mt-3 flex-row items-center" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderWidth: 1 }}><FlaskConical size={14} color="#92400E" /><Text className="text-[10px] font-bold ml-2 flex-1" style={{ color: '#92400E' }}>{demos.length} {t('demoRecords')} · {t('demonstrationData')} · {currency(demos.reduce((sum, b) => sum + (b.pricing?.estimated_lot_value_etb ?? 0), 0))}</Text></View> : null}
      <View className="flex-row items-center justify-between mt-7 mb-3"><Text className="text-lg font-black" style={{ color: theme.colors.espresso }}>{t('recentActivity')}</Text><Pressable onPress={() => router.push('/(tabs)/batches')} className="flex-row items-center py-1"><Text className="text-xs font-bold mr-1" style={{ color: theme.colors.cherry }}>{t('viewAll')}</Text><ChevronRight size={15} color={theme.colors.cherry} /></Pressable></View>
      {recent.length === 0 ? (
        <View className="rounded-2xl border p-5 items-center" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.line }}><Coffee size={23} color={theme.colors.cherry} /><Text className="text-sm font-extrabold mt-3" style={{ color: theme.colors.espresso }}>{t('batchHistoryStarts')}</Text><Text className="text-xs text-center mt-1 leading-5" style={{ color: theme.colors.secondary }}>{t('firstBatchHint')}</Text><Pressable onPress={() => router.push('/(tabs)/scan')} className="rounded-xl px-5 py-3 mt-4" style={{ backgroundColor: theme.colors.espresso }}><Text className="text-xs font-bold text-white">{t('startFirstScan')}</Text></Pressable></View>
      ) : recent.map((batch) => (
        <Pressable key={batch.id} onPress={() => router.push('/batch/' + batch.id)} className="rounded-2xl border p-4 mb-2 flex-row items-center" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.line }}>
          <View className="h-10 w-10 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: theme.colors.parchment }}><Coffee size={19} color={theme.colors.espresso} /></View>
          <View className="flex-1"><Text className="text-sm font-extrabold" style={{ color: theme.colors.espresso }}>{batch.batch_code}</Text><View className="flex-row items-center mt-1"><Clock3 size={11} color={theme.colors.secondary} /><Text className="text-[11px] ml-1" style={{ color: theme.colors.secondary }}>{batch.woreda} · {new Date(batch.created_at).toLocaleDateString()}</Text></View></View>
          <View className="rounded-lg px-2.5 py-1.5" style={{ backgroundColor: batch.status === 'demo' ? '#FFFBEB' : theme.colors.emeraldSoft }}><Text className="text-xs font-black" style={{ color: batch.status === 'demo' ? theme.colors.harvest : theme.colors.emerald }}>{batch.status === 'demo' ? t('demoLabel') : batch.result?.ecx_grade ?? t('pending')}</Text></View><ChevronRight size={16} color={theme.colors.muted} />
        </Pressable>
      ))}
      <Text className="text-[10px] text-center mt-5 leading-4" style={{ color: theme.colors.secondary }}>{t('coffeeValueDisclaimer')}</Text>
    </ScrollView>
  );
}
