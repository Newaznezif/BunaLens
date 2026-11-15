import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { WifiOff, RefreshCw } from 'lucide-react-native';
import { useOfflineQueue } from '@/contexts/OfflineQueueContext';

export default function OfflineBanner() {
  const { online, pendingCount, syncing, syncNow } = useOfflineQueue();
  if (online && pendingCount === 0) return null;
  return (
    <View className={`p-3 rounded-xl border mb-4 ${online ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
      <View className="flex-row items-center">
        <WifiOff size={15} color={online ? '#065F46' : '#92400E'} />
        <Text className={`font-bold text-xs ml-2 flex-1 ${online ? 'text-emerald-900' : 'text-amber-900'}`}>
          {online ? 'Connection restored' : 'Offline'} · {pendingCount} pending sample(s)
        </Text>
      </View>
      {online && pendingCount > 0 ? (
        <Pressable disabled={syncing} onPress={() => void syncNow()} className="bg-espresso rounded-lg p-2.5 mt-2 flex-row justify-center items-center">
          {syncing ? <ActivityIndicator color="white" /> : <><RefreshCw size={13} color="white" /><Text className="text-white font-bold text-xs ml-2">Sync now</Text></>}
        </Pressable>
      ) : null}
    </View>
  );
}
