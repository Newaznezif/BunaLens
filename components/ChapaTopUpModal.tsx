import React, { useState } from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { CheckCircle2, CreditCard } from 'lucide-react-native';
import type { ChapaPackage } from '@/services/chapaService';

export default function ChapaTopUpModal({
  visible, onClose, onConfirm, busy = false, demoMode = false,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (packageId: ChapaPackage) => void;
  busy?: boolean;
  demoMode?: boolean;
}) {
  const [selected, setSelected] = useState<ChapaPackage>('starter_50');
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 justify-end">
        <View className="bg-parchment rounded-t-3xl p-5">
          <View className="flex-row items-center mb-2"><CreditCard size={19} color="#2C1810" /><Text className="text-espresso text-xl font-black ml-2">Station credits</Text></View>
          <Text className="text-stone-500 text-xs mb-4">Choose a package. Credits are added only after a verified payment, or locally in clearly marked demo mode.</Text>
          {([
            { id: 'starter_50' as const, title: 'Starter Pack', detail: '50 scan credits', price: '500 ETB' },
            { id: 'station_pro_monthly' as const, title: 'Washing Station Pro', detail: 'Unlimited scans for 30 days', price: '2,500 ETB / month' },
          ]).map((item) => (
            <Pressable key={item.id} onPress={() => setSelected(item.id)} className={`rounded-2xl p-4 mb-3 border-2 flex-row items-center ${selected === item.id ? 'border-cherry bg-white' : 'border-line bg-white'}`}>
              <View className="flex-1"><Text className="text-espresso font-extrabold">{item.title}</Text><Text className="text-stone-500 text-xs mt-1">{item.detail}</Text><Text className="text-cherry font-black mt-2">{item.price}</Text></View>
              {selected === item.id ? <CheckCircle2 size={20} color="#B91C1C" /> : <View className="w-5 h-5 rounded-full border border-stone-300" />}
            </Pressable>
          ))}
          {demoMode ? <View className="bg-amber-50 border border-amber-200 p-3 rounded-xl mb-3"><Text className="text-amber-900 text-xs font-bold">DEMO SANDBOX — no real payment will be made.</Text></View> : null}
          <Pressable disabled={busy} onPress={() => onConfirm(selected)} className="bg-cherry p-4 rounded-xl mt-1">{busy ? <ActivityIndicator color="white" /> : <Text className="text-white text-center font-bold">{demoMode ? 'Simulate demo purchase' : 'Continue to Chapa checkout'}</Text>}</Pressable>
          <Pressable onPress={onClose} disabled={busy} className="p-3"><Text className="text-espresso text-center">Cancel</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}
