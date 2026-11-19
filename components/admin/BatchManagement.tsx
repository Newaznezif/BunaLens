import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AlertCircle, ArrowLeft, ChevronLeft, ChevronRight, Coffee, Eye, Filter, ImageOff, RefreshCw, Search, X } from 'lucide-react-native';
import { supabase } from '@/services/supabaseClient';

type Batch = {
  id: string;
  batch_code: string;
  station_id: string;
  sample_type: string;
  woreda: string;
  latitude: number | null;
  longitude: number | null;
  gps_latitude: number | null;
  gps_longitude: number | null;
  lot_weight_kg: number;
  lot_weight_feresula: number | null;
  image_path: string | null;
  grading_status: string;
  ecx_grade: string;
  quality_score: number | null;
  confidence_score: number | null;
  estimated_price_per_feresula_etb: number | null;
  total_estimated_value_etb: number | null;
  potential_gain_if_sorted_etb: number | null;
  grading_result: Record<string, any>;
  pricing_result: Record<string, any> | null;
  is_demo: boolean;
  created_at: string;
  updated_at: string;
  stations?: { name?: string | null; station_name?: string | null; manager?: string | null; zone?: string | null; woreda?: string | null }[] | null;
};
type GradingRecord = {
  id: string;
  breakdown: Record<string, unknown>;
  export_readiness: string;
  sorting_action_advice: string;
  assessment_limitations: string[];
  assessment_method: string;
  model_version: string | null;
  created_at: string;
};
type StatusFilter = 'all' | 'queued' | 'processing' | 'completed' | 'failed';

const panel = { backgroundColor: '#FFFFFF', borderColor: '#E5E9E0', borderWidth: 1, borderRadius: 18 } as const;
const ink = '#26372D';
const muted = '#727C70';
const green = '#55765D';
const PAGE_SIZE = 20;

function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function statusStyle(value: string) {
  const status = value.toLowerCase();
  if (status === 'completed') return { bg: '#EAF1E8', fg: green };
  if (status === 'queued' || status === 'processing' || status === 'pending') return { bg: '#F6EFE3', fg: '#9A6A37' };
  if (status === 'failed' || status === 'rejected') return { bg: '#F7EAE5', fg: '#A34F3E' };
  return { bg: '#F0F1ED', fg: muted };
}
function StatusPill({ value }: { value: string }) {
  const tone = statusStyle(value || 'unknown');
  return <View style={{ backgroundColor: tone.bg, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 5, alignSelf: 'flex-start' }}>
    <Text style={{ color: tone.fg, fontSize: 9, fontWeight: '900', textTransform: 'capitalize' }}>{(value || 'unknown').replaceAll('_', ' ')}</Text>
  </View>;
}
function Metric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return <View style={{ ...panel, padding: 13, flexGrow: 1, flexBasis: 145, minWidth: 125 }}>
    <Text style={{ color: muted, fontSize: 10, fontWeight: '800' }}>{label}</Text>
    <Text style={{ color: ink, fontSize: 25, fontWeight: '900', marginTop: 7 }}>{value.toLocaleString()}</Text>
    <Text style={{ color: muted, fontSize: 9, marginTop: 3 }}>{detail}</Text>
  </View>;
}
function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, paddingVertical: 9, borderBottomWidth: 1, borderColor: '#EEF0EC' }}>
    <Text style={{ color: muted, fontSize: 10, flex: 1 }}>{label}</Text>
    <Text style={{ color: ink, fontSize: 10, fontWeight: '800', flex: 1.3, textAlign: 'right' }}>{value || '—'}</Text>
  </View>;
}

export default function BatchManagement() {
  const [rows, setRows] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ completed: 0, processing: 0, failed: 0 });
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [sampleType, setSampleType] = useState<'all' | 'green_bean' | 'red_cherry'>('all');
  const [includeDemo, setIncludeDemo] = useState(false);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Batch | null>(null);
  const [detail, setDetail] = useState<GradingRecord | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!supabase) {
      setError('Supabase is not configured for this environment.');
      setLoading(false);
      return;
    }
    if (quiet) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      let query = supabase.from('coffee_batches')
        .select('id,batch_code,station_id,sample_type,woreda,latitude,longitude,gps_latitude,gps_longitude,lot_weight_kg,lot_weight_feresula,image_path,grading_status,ecx_grade,quality_score,confidence_score,estimated_price_per_feresula_etb,total_estimated_value_etb,potential_gain_if_sorted_etb,grading_result,pricing_result,is_demo,created_at,updated_at,stations(name,station_name,manager,zone,woreda)', { count: 'exact' })
        .order('created_at', { ascending: false });
      if (!includeDemo) query = query.eq('is_demo', false);
      if (status !== 'all') query = query.eq('grading_status', status);
      if (sampleType !== 'all') query = query.eq('sample_type', sampleType);
      if (search) {
        const safe = search.replace(/[,%()]/g, ' ').trim();
        if (safe) query = query.or('batch_code.ilike.%' + safe + '%,woreda.ilike.%' + safe + '%,ecx_grade.ilike.%' + safe + '%');
      }
      const from = page * PAGE_SIZE;
      const { data, count, error: queryError } = await query.range(from, from + PAGE_SIZE - 1);
      if (queryError) throw queryError;

      const [completed, processing, failed] = await Promise.all([
        supabase.from('coffee_batches').select('id', { count: 'exact', head: true }).eq('is_demo', false).eq('grading_status', 'completed'),
        supabase.from('coffee_batches').select('id', { count: 'exact', head: true }).eq('is_demo', false).eq('grading_status', 'processing'),
        supabase.from('coffee_batches').select('id', { count: 'exact', head: true }).eq('is_demo', false).eq('grading_status', 'failed'),
      ]);
      const summaryError = [completed, processing, failed].find((result) => result.error);
      if (summaryError?.error) throw summaryError.error;
      setRows((data || []) as Batch[]);
      setTotal(count || 0);
      setSummary({ completed: completed.count || 0, processing: processing.count || 0, failed: failed.count || 0 });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Batch records could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [includeDemo, status, sampleType, search, page]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel('bunalens-admin-batch-management')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coffee_batches' }, () => { void load(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grading_results' }, () => { void load(true); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const openBatch = useCallback(async (batch: Batch) => {
    setSelected(batch);
    setDetail(null);
    setImageUrl(null);
    setDetailError('');
    setDetailLoading(true);
    try {
      if (!supabase) throw new Error('Supabase is not configured.');
      const [grading, signedImage] = await Promise.all([
        supabase.from('grading_results')
          .select('id,breakdown,export_readiness,sorting_action_advice,assessment_limitations,assessment_method,model_version,created_at')
          .eq('batch_id', batch.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        batch.image_path
          ? supabase.storage.from('coffee-samples').createSignedUrl(batch.image_path, 60 * 10)
          : Promise.resolve({ data: null, error: null }),
      ]);
      if (grading.error) throw grading.error;
      if (signedImage.error) throw signedImage.error;
      setDetail((grading.data || null) as GradingRecord | null);
      setImageUrl(signedImage.data?.signedUrl || null);
    } catch (cause) {
      setDetailError(cause instanceof Error ? cause.message : 'Some batch details could not be loaded.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const maxPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageStart = total ? page * PAGE_SIZE + 1 : 0;
  const pageEnd = Math.min((page + 1) * PAGE_SIZE, total);
  const stationName = (batch: Batch) => batch.stations?.[0]?.station_name || batch.stations?.[0]?.name || 'Station not linked';
  const result = selected?.grading_result || {};
  const breakdown = detail?.breakdown || result.breakdown || {};
  const breakdownEntries = useMemo(() => Object.entries(breakdown).filter(([, value]) => typeof value === 'number'), [breakdown]);

  const submitSearch = () => { setPage(0); setSearch(searchInput.trim()); };

  return <View style={{ gap: 15 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: ink, fontSize: 18, fontWeight: '900' }}>Batch Management</Text>
        <Text style={{ color: muted, fontSize: 11, marginTop: 4 }}>Search, inspect and monitor submitted coffee samples across registered stations.</Text>
      </View>
      <Pressable onPress={() => void load(true)} disabled={refreshing} style={{ borderWidth: 1, borderColor: '#DDE4DA', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: refreshing ? 0.6 : 1 }}>
        <RefreshCw size={14} color={green} /><Text style={{ color: green, fontSize: 10, fontWeight: '800' }}>{refreshing ? 'Refreshing' : 'Refresh'}</Text>
      </Pressable>
    </View>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
      <Metric label="Matching batches" value={total} detail="Based on current filters" />
      <Metric label="Completed" value={summary.completed} detail="All non-demo batches" />
      <Metric label="Processing" value={summary.processing} detail="Currently in progress" />
      <Metric label="Failed" value={summary.failed} detail="Failed assessments" />
    </View>

    <View style={{ ...panel, padding: 12, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Search size={16} color={muted} />
        <TextInput value={searchInput} onChangeText={setSearchInput} onSubmitEditing={submitSearch} returnKeyType="search" placeholder="Search batch code, woreda or grade" placeholderTextColor="#929A91" style={{ flex: 1, color: ink, paddingVertical: 8, fontSize: 11, outlineStyle: 'none' as any }} />
        <Pressable onPress={submitSearch} style={{ backgroundColor: '#26372D', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9 }}><Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: '800' }}>Search</Text></Pressable>
      </View>
      <View style={{ height: 1, backgroundColor: '#EEF0EC' }} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
        <Filter size={14} color={muted} />
        {(['all', 'queued', 'processing', 'completed', 'failed'] as StatusFilter[]).map((value) => <Pressable key={value} onPress={() => { setStatus(value); setPage(0); }} style={{ backgroundColor: status === value ? '#26372D' : '#F1F3EF', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 }}>
          <Text style={{ color: status === value ? '#FFFFFF' : muted, fontSize: 9, fontWeight: '800', textTransform: 'capitalize' }}>{value === 'all' ? 'All statuses' : value}</Text>
        </Pressable>)}
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center' }}>
        {(['all', 'green_bean', 'red_cherry'] as const).map((value) => <Pressable key={value} onPress={() => { setSampleType(value); setPage(0); }} style={{ backgroundColor: sampleType === value ? '#EAF1E8' : '#F1F3EF', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 }}>
          <Text style={{ color: sampleType === value ? green : muted, fontSize: 9, fontWeight: '800' }}>{value === 'all' ? 'All sample types' : value === 'green_bean' ? 'Green bean' : 'Red cherry'}</Text>
        </Pressable>)}
        <Pressable onPress={() => { setIncludeDemo((current) => !current); setPage(0); }} style={{ marginLeft: 'auto', backgroundColor: includeDemo ? '#F6EFE3' : '#F1F3EF', borderRadius: 99, paddingHorizontal: 10, paddingVertical: 7 }}>
          <Text style={{ color: includeDemo ? '#9A6A37' : muted, fontSize: 9, fontWeight: '800' }}>{includeDemo ? 'Demo included' : 'Exclude demo'}</Text>
        </Pressable>
      </View>
    </View>

    {error ? <View style={{ ...panel, padding: 12, borderColor: '#E7BDB3', backgroundColor: '#FBF0ED', flexDirection: 'row', gap: 8 }}>
      <AlertCircle size={15} color="#A34F3E" /><Text style={{ color: '#7D3C32', fontSize: 10, flex: 1 }}>{error}</Text>
    </View> : null}

    <View style={{ ...panel, overflow: 'hidden' }}>
      {loading ? <View style={{ padding: 38, alignItems: 'center' }}><ActivityIndicator size="large" color={green} /><Text style={{ color: muted, fontSize: 10, marginTop: 9 }}>Loading batch records…</Text></View> : rows.map((batch, index) => (
        <Pressable key={batch.id} onPress={() => void openBatch(batch)} style={{ padding: 13, borderBottomWidth: index === rows.length - 1 ? 0 : 1, borderColor: '#EEF0EC', flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 39, height: 39, borderRadius: 13, backgroundColor: '#EAF1E8', alignItems: 'center', justifyContent: 'center' }}><Coffee size={17} color={green} /></View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: ink, fontSize: 11, fontWeight: '900' }}>{batch.batch_code}</Text>
            <Text numberOfLines={1} style={{ color: muted, fontSize: 9, marginTop: 3 }}>{stationName(batch)} · {batch.woreda}</Text>
            <Text style={{ color: '#929A91', fontSize: 9, marginTop: 3 }}>{batch.sample_type === 'green_bean' ? 'Green bean' : batch.sample_type === 'red_cherry' ? 'Red cherry' : batch.sample_type} · {formatDate(batch.created_at)}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', gap: 5 }}>
            <Text style={{ color: ink, fontSize: 10, fontWeight: '900' }}>{batch.quality_score == null ? 'Unscored' : Math.round(batch.quality_score) + '/100'}</Text>
            <StatusPill value={batch.grading_status} />
            {batch.is_demo ? <Text style={{ color: '#9A6A37', fontSize: 8, fontWeight: '900' }}>DEMO</Text> : null}
          </View>
          <ChevronRight size={15} color="#929A91" />
        </Pressable>
      ))}
      {!loading && !rows.length ? <View style={{ padding: 25, alignItems: 'center' }}>
        <Coffee size={22} color={muted} />
        <Text style={{ color: ink, fontSize: 11, fontWeight: '900', marginTop: 9 }}>No matching batches</Text>
        <Text style={{ color: muted, fontSize: 10, marginTop: 4, textAlign: 'center' }}>Try changing the search or filters.</Text>
      </View> : null}
    </View>

    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <Text style={{ color: muted, fontSize: 9 }}>{pageStart}–{pageEnd} of {total.toLocaleString()}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
        <Pressable disabled={page === 0 || loading} onPress={() => setPage((value) => Math.max(0, value - 1))} style={{ borderWidth: 1, borderColor: '#DDE4DA', borderRadius: 9, padding: 8, opacity: page === 0 || loading ? 0.35 : 1 }}><ChevronLeft size={15} color={ink} /></Pressable>
        <Text style={{ color: ink, fontSize: 10, fontWeight: '800' }}>Page {page + 1} of {maxPage}</Text>
        <Pressable disabled={page + 1 >= maxPage || loading} onPress={() => setPage((value) => Math.min(maxPage - 1, value + 1))} style={{ borderWidth: 1, borderColor: '#DDE4DA', borderRadius: 9, padding: 8, opacity: page + 1 >= maxPage || loading ? 0.35 : 1 }}><ChevronRight size={15} color={ink} /></Pressable>
      </View>
    </View>

    <Modal visible={!!selected} animationType="slide" onRequestClose={() => setSelected(null)}>
      <View style={{ flex: 1, backgroundColor: '#F3F5EF' }}>
        <View style={{ backgroundColor: '#26372D', paddingHorizontal: 17, paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: 11 }}>
          <Pressable onPress={() => setSelected(null)} style={{ padding: 5 }}><ArrowLeft size={19} color="#FFFFFF" /></Pressable>
          <View style={{ flex: 1 }}><Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: '900' }}>Batch details</Text><Text style={{ color: '#C3D0C1', fontSize: 9, marginTop: 2 }}>{selected?.batch_code}</Text></View>
          <Pressable onPress={() => setSelected(null)} style={{ padding: 5 }}><X size={19} color="#FFFFFF" /></Pressable>
        </View>
        {selected ? <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 13 }}>
          {detailLoading ? <View style={{ padding: 28, alignItems: 'center' }}><ActivityIndicator size="large" color={green} /><Text style={{ color: muted, fontSize: 10, marginTop: 8 }}>Loading batch image and assessment…</Text></View> : null}
          {detailError ? <View style={{ ...panel, padding: 12, borderColor: '#E7BDB3' }}><Text style={{ color: '#7D3C32', fontSize: 10 }}>{detailError}</Text></View> : null}
          {imageUrl ? <Image source={{ uri: imageUrl }} resizeMode="contain" style={{ width: '100%', height: 220, borderRadius: 14, backgroundColor: '#E9ECE6' }} /> : <View style={{ ...panel, height: 100, alignItems: 'center', justifyContent: 'center', gap: 6 }}><ImageOff size={20} color={muted} /><Text style={{ color: muted, fontSize: 10 }}>No accessible sample image</Text></View>}
          <View style={{ ...panel, padding: 14, gap: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}><Text style={{ color: ink, fontSize: 15, fontWeight: '900' }}>{selected.batch_code}</Text><StatusPill value={selected.grading_status} /></View>
            <Text style={{ color: muted, fontSize: 10 }}>{stationName(selected)} · {selected.woreda}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 5 }}>
              <View style={{ flex: 1, minWidth: 110, backgroundColor: '#F2F5F0', padding: 11, borderRadius: 12 }}><Text style={{ color: muted, fontSize: 9 }}>Quality score</Text><Text style={{ color: ink, fontSize: 22, fontWeight: '900', marginTop: 4 }}>{selected.quality_score == null ? '—' : Number(selected.quality_score).toFixed(1) + '/100'}</Text></View>
              <View style={{ flex: 1, minWidth: 110, backgroundColor: '#F2F5F0', padding: 11, borderRadius: 12 }}><Text style={{ color: muted, fontSize: 9 }}>AI confidence</Text><Text style={{ color: ink, fontSize: 22, fontWeight: '900', marginTop: 4 }}>{selected.confidence_score == null ? '—' : Number(selected.confidence_score).toFixed(1) + '%'}</Text></View>
            </View>
            <DetailRow label="Sample type" value={selected.sample_type.replaceAll('_', ' ')} />
            <DetailRow label="ECX grade" value={selected.ecx_grade} />
            <DetailRow label="Lot weight" value={Number(selected.lot_weight_kg).toLocaleString() + ' kg'} />
            <DetailRow label="Woreda" value={selected.woreda} />
            <DetailRow label="Station manager" value={selected.stations?.[0]?.manager || '—'} />
            <DetailRow label="Submitted" value={formatDate(selected.created_at)} />
            <DetailRow label="Last updated" value={formatDate(selected.updated_at)} />
            <DetailRow label="Batch ID" value={selected.id} />
            {selected.is_demo ? <Text style={{ color: '#9A6A37', fontSize: 9, fontWeight: '900' }}>DEMONSTRATION RECORD</Text> : null}
          </View>
          <View style={{ ...panel, padding: 14, gap: 8 }}>
            <Text style={{ color: ink, fontSize: 13, fontWeight: '900' }}>Assessment breakdown</Text>
            {breakdownEntries.length ? breakdownEntries.map(([key, value]) => <DetailRow key={key} label={key.replaceAll('_', ' ').replace(/ pct$/, '')} value={Number(value).toFixed(1) + (key.endsWith('_pct') ? '%' : '')} />) : <Text style={{ color: muted, fontSize: 10 }}>No structured defect breakdown is available.</Text>}
            <DetailRow label="Export readiness" value={detail?.export_readiness || String(result.export_readiness || '—')} />
            <DetailRow label="Assessment method" value={detail?.assessment_method || String(result.assessment_method || '—')} />
            <DetailRow label="Model version" value={detail?.model_version || 'Not recorded'} />
            {detail?.sorting_action_advice || result.sorting_action_advice ? <View style={{ backgroundColor: '#F6EFE3', borderRadius: 12, padding: 11, marginTop: 5 }}><Text style={{ color: '#8C6338', fontSize: 9, fontWeight: '900' }}>SORTING RECOMMENDATION</Text><Text style={{ color: '#594B38', fontSize: 10, lineHeight: 16, marginTop: 5 }}>{detail?.sorting_action_advice || String(result.sorting_action_advice)}</Text></View> : null}
            {(detail?.assessment_limitations || result.assessment_limitations || []).length ? <View style={{ marginTop: 4, gap: 5 }}><Text style={{ color: muted, fontSize: 9, fontWeight: '900' }}>ASSESSMENT LIMITATIONS</Text>{(detail?.assessment_limitations || result.assessment_limitations || []).map((item: string, index: number) => <Text key={index} style={{ color: muted, fontSize: 9, lineHeight: 14 }}>• {item}</Text>)}</View> : null}
          </View>
          <View style={{ ...panel, padding: 14, gap: 3 }}>
            <Text style={{ color: ink, fontSize: 13, fontWeight: '900', marginBottom: 5 }}>Estimated valuation</Text>
            <DetailRow label="Price per feresula" value={selected.estimated_price_per_feresula_etb == null ? 'Not available' : Number(selected.estimated_price_per_feresula_etb).toLocaleString() + ' ETB'} />
            <DetailRow label="Estimated lot value" value={selected.total_estimated_value_etb == null ? 'Not available' : Number(selected.total_estimated_value_etb).toLocaleString() + ' ETB'} />
            <DetailRow label="Potential gain after sorting" value={selected.potential_gain_if_sorted_etb == null ? 'Not available' : Number(selected.potential_gain_if_sorted_etb).toLocaleString() + ' ETB'} />
            <Text style={{ color: muted, fontSize: 9, lineHeight: 14, marginTop: 7 }}>AI-derived visual estimates are indicative only and are not a certified ECX grade or guaranteed market price.</Text>
          </View>
        </ScrollView> : null}
      </View>
    </Modal>
  </View>;
}
