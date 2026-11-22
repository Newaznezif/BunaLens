import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Award, BadgeCheck, CalendarDays, Coffee, ExternalLink, RefreshCw, Search, ShieldCheck } from 'lucide-react-native';
import { router } from 'expo-router';
import { supabase } from '@/services/supabaseClient';

type Joined<T> = T | T[] | null;
type CertificateRow = {
  id: string; batch_id: string; batch_code: string | null; seller_display_name: string;
  origin_woreda: string; coffee_stage: string; available_kg: number; price_per_kg_etb: number;
  screening_summary: string; published_at: string | null; created_at: string; evidence_summary: any;
  coffee_batches: Joined<{
    id: string; verification_id: string; certified_grade: string; quality_classification: string;
    certification_origin_zone: string | null; certified_at: string | null; certification_note: string | null;
    lot_weight_kg: number; created_at: string;
  }>;
  stations: Joined<{ name: string | null; manager: string | null; woreda: string | null }>;
};

const card = { backgroundColor: '#FFFFFF', borderColor: '#E5E9E0', borderWidth: 1, borderRadius: 20 } as const;
const one = <T,>(value: Joined<T>): T | null => Array.isArray(value) ? value[0] ?? null : value;

function formatDate(value?: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—';
}

/** Administrator archive of lots that have passed certification and are publicly published. */
export default function PublishedCertificates() {
  const [rows, setRows] = useState<CertificateRow[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    if (quiet) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const { data, error: queryError } = await supabase
        .from('marketplace_listings')
        .select('id,batch_id,batch_code,seller_display_name,origin_woreda,coffee_stage,available_kg,price_per_kg_etb,screening_summary,published_at,created_at,evidence_summary,coffee_batches!marketplace_listings_batch_id_fkey(id,verification_id,certified_grade,quality_classification,certification_origin_zone,certified_at,certification_note,lot_weight_kg,created_at),stations(name,manager,woreda)')
        .eq('status', 'published')
        .eq('is_demo', false)
        .order('published_at', { ascending: false });
      if (queryError) throw queryError;
      setRows((data || []) as unknown as CertificateRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Published certificates could not be loaded.');
    } finally { setLoading(false); setRefreshing(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const batch = one(row.coffee_batches);
      const station = one(row.stations);
      return !q || [
        row.batch_code, row.seller_display_name, row.origin_woreda,
        batch?.certified_grade, batch?.quality_classification, batch?.verification_id,
        station?.name, station?.manager,
      ].some((value) => String(value ?? '').toLowerCase().includes(q));
    });
  }, [rows, search]);

  return (
    <View style={{ gap: 15 }}>
      <View style={{ ...card, padding: 19, backgroundColor: '#26372D', borderColor: '#26372D', overflow: 'hidden' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#BBD3B3', fontSize: 9, fontWeight: '900', letterSpacing: 1.5 }}>CERTIFICATION ARCHIVE</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '900', marginTop: 6 }}>Published Certificates</Text>
            <Text style={{ color: '#D0D9CE', fontSize: 11, lineHeight: 17, marginTop: 6 }}>A permanent admin workspace for certified coffee lots that are currently visible to public Marketplace visitors.</Text>
          </View>
          <View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: '#3C5142', alignItems: 'center', justifyContent: 'center', marginLeft: 12 }}><Award size={27} color="#DDEAD6" /></View>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 18, gap: 9 }}>
          <View style={{ flex: 1, backgroundColor: '#35473A', borderRadius: 13, padding: 12 }}>
            <Text style={{ color: '#BBD3B3', fontSize: 9, fontWeight: '800' }}>PUBLIC CERTIFICATES</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 3 }}>{rows.length.toLocaleString()}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: '#35473A', borderRadius: 13, padding: 12 }}>
            <Text style={{ color: '#BBD3B3', fontSize: 9, fontWeight: '800' }}>TOTAL PUBLIC STOCK</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 25, fontWeight: '900', marginTop: 3 }}>{rows.reduce((sum, row) => sum + Number(row.available_kg || 0), 0).toLocaleString()} <Text style={{ fontSize: 11 }}>kg</Text></Text>
          </View>
        </View>
      </View>

      <View style={{ ...card, padding: 11, flexDirection: 'row', alignItems: 'center' }}>
        <Search size={17} color="#899187" />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search certificate, lot, station, grade or verification ID" placeholderTextColor="#929A91" style={{ flex: 1, padding: 9, color: '#26372D', outlineStyle: 'none' as any }} />
        <Pressable accessibilityLabel="Refresh published certificates" onPress={() => void load(true)} disabled={refreshing} style={{ padding: 8 }}><RefreshCw size={16} color="#55765D" /></Pressable>
      </View>

      {error ? <View style={{ ...card, padding: 14, borderColor: '#E7BDB3', backgroundColor: '#FBF0ED' }}><Text style={{ color: '#963F2D', fontSize: 12 }}>{error}</Text><Pressable onPress={() => void load()} style={{ marginTop: 8 }}><Text style={{ color: '#963F2D', fontWeight: '900', fontSize: 11 }}>Retry</Text></Pressable></View> : null}
      {loading ? <View style={{ padding: 44, alignItems: 'center' }}><ActivityIndicator color="#55765D" /><Text style={{ color: '#727C70', marginTop: 10, fontSize: 11 }}>Loading certified marketplace lots…</Text></View> : null}

      {!loading && !error && filtered.map((row) => {
        const batch = one(row.coffee_batches);
        const station = one(row.stations);
        const verificationId = batch?.verification_id || row.batch_id;
        return (
          <View key={row.id} testID={'published-certificate-' + (row.batch_code || row.batch_id)} style={{ ...card, padding: 16, gap: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <View style={{ width: 39, height: 39, borderRadius: 13, backgroundColor: '#EAF1E8', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}><Coffee size={18} color="#55765D" /></View>
                <View style={{ flex: 1 }}><Text style={{ color: '#26372D', fontSize: 13, fontWeight: '900' }}>{row.batch_code || 'Certified coffee lot'}</Text><Text style={{ color: '#727C70', fontSize: 10, marginTop: 3 }}>{station?.name || row.seller_display_name} · {row.origin_woreda}</Text></View>
              </View>
              <View style={{ backgroundColor: '#EAF4E8', borderRadius: 99, paddingHorizontal: 9, paddingVertical: 6, flexDirection: 'row', alignItems: 'center' }}><BadgeCheck size={12} color="#166534" /><Text style={{ color: '#166534', fontSize: 9, fontWeight: '900', marginLeft: 4 }}>PUBLISHED</Text></View>
            </View>

            <View style={{ backgroundColor: '#F7F8F5', borderRadius: 14, padding: 13 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}><ShieldCheck size={15} color="#55765D" /><Text style={{ color: '#26372D', fontSize: 10, fontWeight: '900', letterSpacing: 0.6, marginLeft: 7 }}>BUNALENS QUALITY CERTIFICATE</Text></View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                <View style={{ minWidth: 95, flexGrow: 1 }}><Text style={{ color: '#899187', fontSize: 9, fontWeight: '800' }}>CERTIFIED GRADE</Text><Text style={{ color: '#26372D', fontSize: 19, fontWeight: '900', marginTop: 3 }}>{batch?.certified_grade || '—'}</Text></View>
                <View style={{ minWidth: 120, flexGrow: 1 }}><Text style={{ color: '#899187', fontSize: 9, fontWeight: '800' }}>QUALITY CLASS</Text><Text style={{ color: '#26372D', fontSize: 12, fontWeight: '900', marginTop: 6 }}>{batch?.quality_classification || '—'}</Text></View>
                <View style={{ minWidth: 110, flexGrow: 1 }}><Text style={{ color: '#899187', fontSize: 9, fontWeight: '800' }}>ORIGIN</Text><Text style={{ color: '#26372D', fontSize: 11, fontWeight: '800', marginTop: 7 }}>{batch?.certification_origin_zone || 'Jimma'} Zone · {row.origin_woreda}</Text></View>
              </View>
              <View style={{ height: 1, backgroundColor: '#E5E9E0', marginVertical: 11 }} />
              <Text style={{ color: '#727C70', fontSize: 9, fontWeight: '800' }}>VERIFICATION ID</Text>
              <Text selectable style={{ color: '#26372D', fontSize: 10, fontWeight: '800', marginTop: 4 }}>{verificationId}</Text>
              {batch?.certification_note ? <Text style={{ color: '#536054', fontSize: 10, lineHeight: 15, marginTop: 8 }}>Review note: {batch.certification_note}</Text> : null}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <View style={{ flex: 1, minWidth: 95, backgroundColor: '#F7F8F5', borderRadius: 11, padding: 10 }}><Text style={{ color: '#899187', fontSize: 9, fontWeight: '800' }}>AVAILABLE STOCK</Text><Text style={{ color: '#26372D', fontSize: 16, fontWeight: '900', marginTop: 3 }}>{Number(row.available_kg).toLocaleString()} kg</Text></View>
              <View style={{ flex: 1, minWidth: 95, backgroundColor: '#F7F8F5', borderRadius: 11, padding: 10 }}><Text style={{ color: '#899187', fontSize: 9, fontWeight: '800' }}>SELLER ASKING PRICE</Text><Text style={{ color: '#166534', fontSize: 16, fontWeight: '900', marginTop: 3 }}>{Number(row.price_per_kg_etb).toLocaleString()} ETB/kg</Text></View>
              <View style={{ flex: 1, minWidth: 95, backgroundColor: '#F7F8F5', borderRadius: 11, padding: 10 }}><Text style={{ color: '#899187', fontSize: 9, fontWeight: '800' }}>PUBLISHED</Text><Text style={{ color: '#26372D', fontSize: 10, fontWeight: '800', marginTop: 7 }}>{formatDate(row.published_at)}</Text></View>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <Text style={{ color: '#727C70', fontSize: 10 }}>{row.coffee_stage === 'green_bean' ? 'Green beans' : 'Red cherries'} · {Number(batch?.lot_weight_kg || row.available_kg).toLocaleString()} kg total lot</Text>
              <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/batch/[id]', params: { id: row.batch_id } })} style={{ backgroundColor: '#26372D', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center' }}><Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '900' }}>Open certificate & lot</Text><ExternalLink size={12} color="#FFFFFF" style={{ marginLeft: 6 }} /></Pressable>
            </View>
          </View>
        );
      })}

      {!loading && !error && filtered.length === 0 ? <View style={{ ...card, padding: 30, alignItems: 'center' }}><View style={{ width: 54, height: 54, borderRadius: 18, backgroundColor: '#EAF1E8', alignItems: 'center', justifyContent: 'center' }}><Award size={25} color="#55765D" /></View><Text style={{ color: '#26372D', fontSize: 15, fontWeight: '900', marginTop: 13 }}>{rows.length ? 'No certificates match this search' : 'No published certificates yet'}</Text><Text style={{ color: '#727C70', fontSize: 11, textAlign: 'center', lineHeight: 17, marginTop: 6 }}>{rows.length ? 'Try a different lot code, station name, grade or verification ID.' : 'When a station owner agrees to publish and an administrator certifies the lot, it will appear here automatically.'}</Text></View> : null}
    </View>
  );
}
