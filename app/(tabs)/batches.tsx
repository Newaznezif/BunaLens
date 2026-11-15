import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View, Pressable, TextInput } from 'react-native';
import { router } from 'expo-router';
import { Search, Layers3, Coffee, ChevronRight, Clock3, ScanLine, SlidersHorizontal } from 'lucide-react-native';
import { useStation } from '@/contexts/StationContext';
import { useLanguage } from '@/contexts/LanguageContext';
import OfflineBanner from '@/components/OfflineBanner';
import { BunaLensTheme as theme } from '@/constants/theme';
import LanguageToggle from '@/components/LanguageToggle';

export default function Batches() {
  const { batches, addBatch } = useStation();
  const { t } = useLanguage();
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'ai' | 'demo'>('all');
  const rows = useMemo(() => batches.filter((batch: any) => {
    const matchesQuery = (batch.batch_code + ' ' + batch.woreda).toLowerCase().includes(q.toLowerCase());
    const matchesFilter = filter === 'all' || (filter === 'demo' ? batch.status === 'demo' : batch.status !== 'demo');
    return matchesQuery && matchesFilter;
  }), [batches, q, filter]);

  return (
    <ScrollView className="flex-1" style={{ backgroundColor: theme.colors.parchment }} contentContainerStyle={{ padding: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
      <View className="flex-row items-center justify-between mb-5">
        <View>
          <Text className="text-2xl font-black" style={{ color: theme.colors.espresso }}>{t('batches')}</Text>
          <Text className="text-xs mt-1" style={{ color: theme.colors.secondary }}>{t('scanHistory')}</Text>
        </View>
        <LanguageToggle />
      </View>
      <View className="rounded-2xl p-4 mb-4 flex-row items-center" style={{ backgroundColor: theme.colors.espresso }}>
        <View className="flex-1">
          <Text className="text-[11px] font-semibold" style={{ color: '#C7B6AC' }}>{t('totalBatches')}</Text>
          <Text className="text-3xl font-black text-white mt-1">{batches.length}</Text>
        </View>
        <View className="h-11 w-11 rounded-xl items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.12)' }}>
          <Coffee size={22} color="#FFFFFF" />
        </View>
      </View>
      <OfflineBanner onSynced={(synced) => synced.forEach(addBatch)} />
      <View className="flex-row items-center rounded-2xl border px-4 mt-4 mb-4" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.line }}>
        <Search size={18} color={theme.colors.secondary} />
        <TextInput value={q} onChangeText={setQ} placeholder={t("searchBatchId")} placeholderTextColor={theme.colors.muted} className="flex-1 py-3.5 px-3 text-sm" style={{ color: theme.colors.espresso }} />
        <SlidersHorizontal size={16} color={theme.colors.secondary} />
      </View>
      <View className="flex-row gap-2 mb-4">
        {([{key:'all',label:'All records'},{key:'ai',label:'AI assessments'},{key:'demo',label:'Demo'}] as const).map(item => (
          <Pressable key={item.key} onPress={() => setFilter(item.key)} className="rounded-full px-4 py-2.5 border" style={{ backgroundColor: filter === item.key ? theme.colors.espresso : theme.colors.surface, borderColor: filter === item.key ? theme.colors.espresso : theme.colors.line }}>
            <Text className="text-[11px] font-bold" style={{ color: filter === item.key ? '#FFFFFF' : theme.colors.secondary }}>{item.label}</Text>
          </Pressable>
        ))}
      </View>
      <View className="flex-row items-center justify-between mb-3">
        <Text className="text-sm font-extrabold" style={{ color: theme.colors.espresso }}>{t('batchHistory')}</Text>
        <Text className="text-[11px] font-semibold" style={{ color: theme.colors.secondary }}>{rows.length} {rows.length === 1 ? t('record') : t('records')}</Text>
      </View>
      {rows.length === 0 ? (
        <View className="rounded-2xl border p-7 items-center mt-2" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.line }}>
          <View className="h-14 w-14 rounded-2xl items-center justify-center" style={{ backgroundColor: theme.colors.cherrySoft }}>
            <ScanLine size={25} color={theme.colors.cherry} />
          </View>
          <Text className="text-sm font-extrabold mt-4" style={{ color: theme.colors.espresso }}>{q || filter !== 'all' ? 'No matching records' : 'No batches recorded yet'}</Text>
          <Text className="text-xs text-center leading-5 mt-1" style={{ color: theme.colors.secondary }}>{q || filter !== 'all' ? 'Try a different search or filter.' : 'Your saved coffee samples and assessments will appear here.'}</Text>
          {!q && filter === 'all' ? <Pressable onPress={() => router.push('/(tabs)/scan')} className="rounded-xl px-5 py-3 mt-4" style={{ backgroundColor: theme.colors.cherry }}><Text className="text-xs font-extrabold text-white">{t('scanFirstSample')}</Text></Pressable> : null}
        </View>
      ) : rows.map((batch: any) => (
        <Pressable key={batch.id} onPress={() => router.push('/batch/' + batch.id)} className="rounded-2xl border p-4 mb-3 flex-row items-center" style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.line }}>
          <View className="h-11 w-11 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: theme.colors.parchment }}>
            <Coffee size={20} color={theme.colors.espresso} />
          </View>
          <View className="flex-1">
            <Text className="text-sm font-extrabold" style={{ color: theme.colors.espresso }}>{batch.batch_code}</Text>
            <View className="flex-row items-center mt-1">
              <Clock3 size={11} color={theme.colors.secondary} />
              <Text className="text-[11px] ml-1" style={{ color: theme.colors.secondary }}>{batch.woreda} · {new Date(batch.created_at).toLocaleDateString()}</Text>
            </View>
            <Text className="text-[10px] mt-1" style={{ color: theme.colors.secondary }}>{batch.sample_type === 'red_cherry' ? 'Red coffee cherries' : 'Green coffee beans'} · {batch.lot_weight_kg} kg</Text>
          </View>
          <View className="items-end mr-2">
            <View className="rounded-lg px-2.5 py-1.5" style={{ backgroundColor: batch.status === 'demo' ? '#FFFBEB' : theme.colors.emeraldSoft }}>
              <Text className="text-xs font-black" style={{ color: batch.status === 'demo' ? theme.colors.harvest : theme.colors.emerald }}>{batch.result?.ecx_grade ?? 'Pending'}</Text>
            </View>
            <Text className="text-[9px] mt-1 font-semibold" style={{ color: theme.colors.secondary }}>{batch.status === 'demo' ? 'DEMO' : batch.status === 'synced' ? 'SYNCED' : 'LOCAL'}</Text>
          </View>
          <ChevronRight size={16} color={theme.colors.muted} />
        </Pressable>
      ))}
      <Text className="text-[10px] text-center mt-3 leading-4" style={{ color: theme.colors.secondary }}>{t('disclaimer')}</Text>
    </ScrollView>
  );
}
