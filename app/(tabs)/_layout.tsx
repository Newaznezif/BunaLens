import React from 'react';
import { Tabs } from 'expo-router';
import { Home, ScanLine, Layers3, Warehouse } from 'lucide-react-native';
import { View, Text } from 'react-native';
import { useLanguage } from '@/contexts/LanguageContext';
import { BunaLensTheme as theme } from '@/constants/theme';

function TabItem({ icon: Icon, label, focused, accent = false }: { icon: React.ComponentType<any>; label: string; focused: boolean; accent?: boolean }) {
  if (accent) {
    return (
      <View className="items-center justify-center" style={{ width: 76, marginTop: -25 }}>
        <View className="h-14 w-14 items-center justify-center rounded-full border-4" style={{ backgroundColor: theme.colors.cherry, borderColor: theme.colors.parchment, elevation: 8, shadowColor: theme.colors.espresso, shadowOpacity: 0.16, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } }}>
          <Icon color="#FFFFFF" size={25} strokeWidth={2.4} />
        </View>
        <Text style={{ color: theme.colors.espresso, fontSize: 10, fontWeight: '800', marginTop: 3 }}>Scan Buna</Text>
      </View>
    );
  }
  return (
    <View className="items-center justify-center" style={{ minWidth: 58, paddingTop: 5 }}>
      <Icon color={focused ? theme.colors.cherry : theme.colors.secondary} size={21} strokeWidth={focused ? 2.5 : 2} />
      <Text numberOfLines={1} style={{ color: focused ? theme.colors.cherry : theme.colors.secondary, fontSize: 10, fontWeight: focused ? '800' : '600', marginTop: 4 }}>{label}</Text>
      {focused ? <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.cherry, marginTop: 3 }} /> : <View style={{ height: 7 }} />}
    </View>
  );
}

export default function TabLayout() {
  const { t } = useLanguage();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: theme.colors.cherry,
        tabBarInactiveTintColor: theme.colors.secondary,
        tabBarStyle: {
          height: 78,
          paddingTop: 8,
          paddingBottom: 8,
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.line,
          borderTopWidth: 1,
          elevation: 12,
          shadowColor: theme.colors.espresso,
          shadowOpacity: 0.07,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: -4 },
        },
        tabBarItemStyle: { paddingVertical: 0 },
      }}
    >
      <Tabs.Screen name="index" options={{ tabBarAccessibilityLabel: 'Home', tabBarIcon: ({ focused }) => <TabItem icon={Home} label={t('home')} focused={focused} /> }} />
      <Tabs.Screen name="scan" options={{ tabBarAccessibilityLabel: t('scan'), tabBarIcon: () => <TabItem icon={ScanLine} label={t('scan')} focused={true} accent /> }} />
      <Tabs.Screen name="batches" options={{ tabBarAccessibilityLabel: 'Batch history', tabBarIcon: ({ focused }) => <TabItem icon={Layers3} label={t('batches')} focused={focused} /> }} />
      <Tabs.Screen name="station" options={{ tabBarAccessibilityLabel: 'Washing station', tabBarIcon: ({ focused }) => <TabItem icon={Warehouse} label={t('station')} focused={focused} /> }} />
    </Tabs>
  );
}
