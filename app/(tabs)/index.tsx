import React, { useMemo } from 'react';
import { ScrollView, View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import {
  ScanLine, TrendingUp, MapPin, ChevronRight, Coffee, ShieldCheck,
  Clock3, ArrowUpRight, Layers3, Wallet, FlaskConical, Sprout,
} from 'lucide-react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStation } from '@/contexts/StationContext';
import { BunaLensTheme as theme } from '@/constants/theme';
import LanguageToggle from '@/components/LanguageToggle';
import OfflineBanner from '@/components/OfflineBanner';

function SectionHeading({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View className="flex-row items-end justify-between mb-3">
      <Text style={{ color: theme.colors.espresso, fontSize: 19, fontWeight: '800', letterSpacing: -0.45 }}>{title}</Text>
      {action && onAction ? (
        <Pressable onPress={onAction} accessibilityRole="button" className="flex-row items-center py-1">
          <Text style={{ color: theme.colors.cherry, fontSize: 11, fontWeight: '800' }}>{action}</Text>
          <ChevronRight size={14} color={theme.colors.cherry} />
        </Pressable>
      ) : null}
    </View>
  );
}

function Metric({ label, value, note, icon: Icon, accent }: {
  label: string; value: string; note: string; icon: React.ComponentType<any>; accent: string;
}) {
  return (
    <View className="flex-1 px-4 py-4" style={{ backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line }}>
      <View className="flex-row items-center justify-between">
        <Text style={{ color: theme.colors.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 0.2 }}>{label}</Text>
        <Icon size={15} color={accent} />
      </View>
      <Text style={{ color: theme.colors.espresso, fontSize: 27, fontWeight: '800', letterSpacing: -1.1, marginTop: 12 }}>{value}</Text>
      <Text style={{ color: theme.colors.secondary, fontSize: 10, marginTop: 3 }}>{note}</Text>
    </View>
  );
}

export default function Home() {
  const { t } = useLanguage();
  const { station, batches } = useStation();
  const actual = useMemo(() => batches.filter((b) => b.status === 'synced' && b.result), [batches]);
  const demos = useMemo(() => batches.filter((b) => b.status === 'demo'), [batches]);
  const avg = actual.length ? Math.round(actual.reduce((sum, b) => sum + b.result.quality_score, 0) / actual.length) : null;
  const pricedActual = actual.filter((b) => b.pricing && !b.pricing.is_demo);
  const actualValue = pricedActual.reduce((sum, b) => sum + (b.pricing?.estimated_lot_value_etb ?? 0), 0);
  const recent = batches.slice(0, 3);
  const currency = (value: number) => value.toLocaleString() + ' ETB';

  return (
    <ScrollView
      className="flex-1"
      style={{ backgroundColor: theme.colors.parchment }}
      contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 38 }}
      showsVerticalScrollIndicator={false}
    >
      <View className="flex-row items-center justify-between mb-5">
        <View className="flex-row items-center">
          <View className="h-10 w-10 items-center justify-center mr-3" style={{ backgroundColor: theme.colors.espresso, borderRadius: 13 }}>
            <Coffee size={21} color={theme.colors.parchment} strokeWidth={1.8} />
          </View>
          <View>
            <Text style={{ color: theme.colors.espresso, fontSize: 19, fontWeight: '900', letterSpacing: -0.7 }}>BunaLens</Text>
            <Text style={{ color: theme.colors.secondary, fontSize: 9, fontWeight: '700', letterSpacing: 1.35, textTransform: 'uppercase' }}>{t('coffeeIntelligence')}</Text>
          </View>
        </View>
        <LanguageToggle />
      </View>

      <OfflineBanner />

      <View className="mb-5 mt-2">
        <View className="flex-row items-center mb-2">
          <View style={{ width: 22, height: 1, backgroundColor: theme.colors.cherry, marginRight: 8 }} />
          <Text style={{ color: theme.colors.cherry, fontSize: 10, fontWeight: '800', letterSpacing: 1.65, textTransform: 'uppercase' }}>ORIGIN INTELLIGENCE · JIMMA</Text>
        </View>
        <Text style={{ color: theme.colors.espresso, fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -1.2, fontFamily: 'Georgia' }}>
          Every bean has{ '\n' }a story.
        </Text>
        <View className="flex-row items-center mt-2">
          <MapPin size={12} color={theme.colors.secondary} />
          <Text style={{ color: theme.colors.secondary, fontSize: 11, marginLeft: 5 }}>{station.woreda} · Oromia, Ethiopia</Text>
          <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.harvest, marginHorizontal: 8 }} />
          <ShieldCheck size={12} color={theme.colors.emerald} />
          <Text style={{ color: theme.colors.secondary, fontSize: 10, marginLeft: 4 }}>{station.name}</Text>
        </View>
      </View>

      <View className="overflow-hidden mb-5" style={{ backgroundColor: theme.colors.espresso, borderRadius: 5 }}>
        <View className="px-5 pt-5 pb-4">
          <View className="flex-row items-center justify-between">
            <Text style={{ color: '#D8C5B5', fontSize: 9, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' }}>{t('stationOverview')}</Text>
            <View className="flex-row items-center rounded-full px-2.5 py-1" style={{ backgroundColor: 'rgba(255,255,255,0.09)' }}>
              <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: '#A7C6A7', marginRight: 6 }} />
              <Text style={{ color: '#E6DCD2', fontSize: 9, fontWeight: '700' }}>STATION SNAPSHOT</Text>
            </View>
          </View>
          <View className="flex-row items-end mt-5">
            <View className="flex-1">
              <Text style={{ color: '#BCA99B', fontSize: 10, fontWeight: '600' }}>{t('credits')}</Text>
              <Text style={{ color: '#FFFDF8', fontSize: 37, lineHeight: 43, fontWeight: '800', letterSpacing: -1.4 }}>{station.credits}</Text>
              <Text style={{ color: '#BCA99B', fontSize: 10 }}>{t('availableScans')}</Text>
            </View>
            <View style={{ width: 1, height: 57, backgroundColor: 'rgba(255,255,255,0.18)', marginHorizontal: 18 }} />
            <View className="flex-1">
              <Text style={{ color: '#BCA99B', fontSize: 10, fontWeight: '600' }}>{t('averageQuality')}</Text>
              <View className="flex-row items-baseline">
                <Text style={{ color: '#FFFDF8', fontSize: 37, lineHeight: 43, fontWeight: '800', letterSpacing: -1.4 }}>{avg === null ? '—' : avg}</Text>
                {avg !== null ? <Text style={{ color: '#BCA99B', fontSize: 12 }}>/100</Text> : null}
              </View>
              <Text style={{ color: '#BCA99B', fontSize: 10 }}>{actual.length ? t('completedScans') : t('noRealAssessments')}</Text>
            </View>
          </View>
        </View>
        <View className="flex-row items-center justify-between px-5 py-3" style={{ backgroundColor: 'rgba(255,255,255,0.055)', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.10)' }}>
          <Text style={{ color: '#D8C5B5', fontSize: 10 }}>{t('welcomeBack')}, {station.manager || station.name}</Text>
          <Sprout size={15} color="#C99B6B" />
        </View>
      </View>

      <Pressable
        accessibilityRole="button"
        onPress={() => router.push('/(tabs)/scan')}
        className="flex-row items-center justify-between px-5 py-5 mb-7"
        style={{ backgroundColor: theme.colors.cherry, borderRadius: 5 }}
      >
        <View className="flex-1 pr-3">
          <Text style={{ color: '#F4DAD3', fontSize: 9, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' }}>{t('aiQualityCheck')}</Text>
          <Text style={{ color: '#FFFFFF', fontSize: 21, fontWeight: '800', letterSpacing: -0.55, marginTop: 5 }}>{t('scanYourCoffee')}</Text>
          <Text style={{ color: '#F4DAD3', fontSize: 11, lineHeight: 17, marginTop: 3 }}>{t('captureAssess')}</Text>
          <View className="flex-row items-center mt-4">
            <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 }}>OPEN CAMERA</Text>
            <ArrowUpRight size={14} color="#FFFFFF" style={{ marginLeft: 5 }} />
          </View>
        </View>
        <View className="items-center justify-center" style={{ width: 62, height: 62, borderWidth: 1, borderColor: 'rgba(255,255,255,0.36)', borderRadius: 31 }}>
          <ScanLine size={27} color="#FFFFFF" strokeWidth={1.6} />
        </View>
      </Pressable>

      <SectionHeading title={t('yourActivity')} />
      <View className="flex-row mb-3" style={{ gap: 10 }}>
        <Metric label={t('totalSavedBatches')} value={String(batches.length)} note={t('savedOnDevice')} icon={Layers3} accent={theme.colors.cherry} />
        <Metric label={t('aiAssessments')} value={String(actual.length)} note={t('completedScans')} icon={TrendingUp} accent={theme.colors.emerald} />
      </View>

      <View className="flex-row items-center px-4 py-4 mb-3" style={{ backgroundColor: theme.colors.surface, borderLeftWidth: 3, borderLeftColor: theme.colors.harvest }}>
        <Wallet size={19} color={theme.colors.harvest} />
        <View className="flex-1 ml-3">
          <Text style={{ color: theme.colors.secondary, fontSize: 10, fontWeight: '700' }}>{t('estimatedCoffeeValue')}</Text>
          <Text style={{ color: theme.colors.espresso, fontSize: 20, fontWeight: '800', letterSpacing: -0.45, marginTop: 2 }}>{pricedActual.length ? currency(actualValue) : '—'}</Text>
          <Text style={{ color: theme.colors.secondary, fontSize: 9, marginTop: 2 }}>{t('actualValueOnly')}</Text>
        </View>
        <TrendingUp size={17} color={theme.colors.harvest} />
      </View>

      {demos.length > 0 ? (
        <View className="flex-row items-center px-3 py-2.5 mb-4" style={{ backgroundColor: theme.colors.harvestSoft, borderWidth: 1, borderColor: '#EAD6B5' }}>
          <FlaskConical size={14} color={theme.colors.harvest} />
          <Text style={{ color: '#805522', fontSize: 10, fontWeight: '700', marginLeft: 8, flex: 1 }}>{demos.length} {t('demoRecords')} · {t('demonstrationData')} · {currency(demos.reduce((sum, b) => sum + (b.pricing?.estimated_lot_value_etb ?? 0), 0))}</Text>
        </View>
      ) : null}

      <SectionHeading title={t('recentActivity')} action={t('viewAll')} onAction={() => router.push('/(tabs)/batches')} />
      {recent.length === 0 ? (
        <View className="px-5 py-7 items-center" style={{ backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line }}>
          <Coffee size={25} color={theme.colors.cherry} />
          <Text style={{ color: theme.colors.espresso, fontSize: 14, fontWeight: '800', marginTop: 12 }}>{t('batchHistoryStarts')}</Text>
          <Text style={{ color: theme.colors.secondary, fontSize: 11, lineHeight: 18, textAlign: 'center', marginTop: 5 }}>{t('firstBatchHint')}</Text>
          <Pressable onPress={() => router.push('/(tabs)/scan')} className="px-5 py-3 mt-4" style={{ backgroundColor: theme.colors.espresso }}>
            <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>{t('startFirstScan')}</Text>
          </Pressable>
        </View>
      ) : recent.map((batch, index) => (
        <Pressable
          key={batch.id}
          onPress={() => router.push({ pathname: '/batch/[id]', params: { id: batch.id } })}
          className="flex-row items-center py-3.5"
          style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.line }}
        >
          <Text style={{ color: theme.colors.muted, fontSize: 10, fontWeight: '800', width: 24 }}>0{index + 1}</Text>
          <View className="items-center justify-center mr-3" style={{ width: 39, height: 39, backgroundColor: '#EDE5D9', borderRadius: 20 }}>
            <Coffee size={17} color={theme.colors.espresso} />
          </View>
          <View className="flex-1">
            <Text style={{ color: theme.colors.espresso, fontSize: 12, fontWeight: '800' }}>{batch.batch_code}</Text>
            <View className="flex-row items-center mt-1">
              <Clock3 size={10} color={theme.colors.secondary} />
              <Text style={{ color: theme.colors.secondary, fontSize: 10, marginLeft: 4 }}>{batch.woreda} · {new Date(batch.created_at).toLocaleDateString()}</Text>
            </View>
          </View>
          <View className="px-2.5 py-1" style={{ backgroundColor: batch.status === 'demo' ? theme.colors.harvestSoft : theme.colors.emeraldSoft }}>
            <Text style={{ color: batch.status === 'demo' ? theme.colors.harvest : theme.colors.emerald, fontSize: 9, fontWeight: '800' }}>{batch.status === 'demo' ? t('demoLabel') : batch.result?.ecx_grade ?? t('pending')}</Text>
          </View>
          <ChevronRight size={15} color={theme.colors.muted} style={{ marginLeft: 5 }} />
        </Pressable>
      ))}

      <Text style={{ color: theme.colors.secondary, fontSize: 9, lineHeight: 15, textAlign: 'center', marginTop: 20 }}>{t('coffeeValueDisclaimer')}</Text>
    </ScrollView>
  );
}
