import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { buildCoffeeMapHtml, type CoffeeMapPoint, type CoffeeMapSite } from './coffeeMapHtml';

type Props = { site: CoffeeMapSite; points: CoffeeMapPoint[]; zoom: boolean; onToggle: () => void };
const INK = '#26372D';
const MUTED = '#727C70';
const GREEN = '#55765D';
const BORDER = '#E5E9E0';

export default function CoffeeOriginMap({ site, points, zoom, onToggle }: Props) {
  const html = useMemo(() => buildCoffeeMapHtml(site, points, zoom), [site, points, zoom]);
  return (
    <View style={{ backgroundColor: '#FFFFFF', borderColor: BORDER, borderWidth: 1, borderRadius: 18, padding: 15, flex: 1, minWidth: 280 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: INK, fontSize: 15, fontWeight: '900' }}>Ethiopia Origin & Jimma Coffee Cluster</Text>
          <Text style={{ color: MUTED, fontSize: 10, marginTop: 3 }}>OpenFreeMap · OpenStreetMap data · administrative boundaries</Text>
        </View>
        <Pressable onPress={onToggle} style={{ backgroundColor: INK, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 }}>
          <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: '900' }}>{zoom ? 'Full Ethiopia View' : 'Zoom to Jimma'}</Text>
        </Pressable>
      </View>
      <View style={{ width: '100%', height: 360, marginTop: 12, borderRadius: 12, overflow: 'hidden', backgroundColor: '#E9EEE8' }}>
        {React.createElement('iframe' as any, {
          title: 'BunaLens Ethiopia and Jimma coffee origin map',
          srcDoc: html,
          sandbox: 'allow-scripts allow-same-origin',
          allow: 'geolocation',
          style: { width: '100%', height: '100%', border: 0, display: 'block' },
          loading: 'lazy',
        })}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 }}>
        <Text style={{ color: MUTED, fontSize: 9 }}>● Selected coffee site</Text>
        <Text style={{ color: GREEN, fontSize: 9 }}>● Other coffee sites</Text>
        <Text style={{ color: '#8B4D36', fontSize: 9 }}>● GBIF native occurrence</Text>
      </View>
      <Text style={{ color: MUTED, fontSize: 9, marginTop: 8, lineHeight: 14 }}>Map tiles: OpenFreeMap © OpenMapTiles · Data © OpenStreetMap contributors. Administrative boundaries: geoBoundaries gbOpen (CC BY 4.0).</Text>
    </View>
  );
}
