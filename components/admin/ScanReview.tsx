import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { CheckCircle2, RefreshCw, XCircle, ShieldCheck, Coffee } from 'lucide-react-native';
import { supabase } from '@/services/supabaseClient';

type ScanRow = {
  id: string; batch_code: string; sample_type: string; woreda: string; lot_weight_kg: number;
  grading_status: string; eligibility_status: string; is_demo: boolean; created_at: string;
  grading_result: any;
  stations?: { name: string | null; station_name?: string | null; manager: string | null; marketplace_seller_status: string }[] | null;
};
const panel = { backgroundColor: '#FFFFFF', borderColor: '#E5E9E0', borderWidth: 1, borderRadius: 18 } as const;
const green = '#55765D', ink = '#26372D', muted = '#727C70';

export default function AdminScanReview() {
  const [rows, setRows] = useState<ScanRow[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: queryError } = await supabase
      .from('coffee_batches')
      .select('id,batch_code,sample_type,woreda,lot_weight_kg,grading_status,eligibility_status,is_demo,created_at,grading_result,stations(name,station_name,manager,marketplace_seller_status)')
      .order('created_at', { ascending: false }).limit(500);
    if (queryError) setError(queryError.message);
    else setRows((data || []) as unknown as ScanRow[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const decide = async (row: ScanRow, decision: 'eligible' | 'rejected') => {
    if (!supabase) return;
    const reason = (reasons[row.id] || '').trim();
    if (reason.length < 10) { setError('Add a review reason of at least 10 characters for ' + row.batch_code + '.'); return; }
    const price = Number(prices[row.id]);
    if (decision === 'eligible' && (!Number.isFinite(price) || price <= 0)) {
      setError('Enter the public price per kg in ETB before approving ' + row.batch_code + '.'); return;
    }
    setBusyId(row.id); setError(''); setNotice('');
    const { error: rpcError } = await supabase.rpc('bunalens_admin_review_and_publish_lot', {
      p_batch_id: row.id, p_decision: decision, p_reason: reason,
      p_price_per_kg_etb: decision === 'eligible' ? price : null,
    });
    if (rpcError) setError(rpcError.message);
    else { setNotice(decision === 'eligible' ? row.batch_code + ' approved and published.' : row.batch_code + ' rejected.'); await load(); }
    setBusyId('');
  };

  const approveSeller = async (row: ScanRow) => {
    if (!supabase) return;
    const stationId = (row as any).station_id;
    const station = row.stations?.[0];
    if (!stationId) { setError('Station identifier is unavailable for this scan.'); return; }
    setBusyId(row.id); setError(''); setNotice('');
    const { error: rpcError } = await supabase.rpc('bunalens_set_seller_status', {
      p_station_id: stationId, p_status: 'approved',
      p_note: 'Marketplace seller approved by administrator after station review.',
    });
    if (rpcError) setError(rpcError.message);
    else { setNotice('Seller approved. You can now review and publish its scans.'); await load(); }
    setBusyId('');
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ ...panel, padding: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}><Text style={{ color: ink, fontSize: 17, fontWeight: '900' }}>Scan review queue</Text><Text style={{ color: muted, fontSize: 11, marginTop: 4 }}>Every cloud-saved coffee scan appears here. Only administrator-approved, live-evidence lots can be published.</Text></View>
        <Pressable onPress={() => void load()} style={{ padding: 10 }}><RefreshCw size={17} color={green} /></Pressable>
      </View>
      {error ? <Text accessibilityRole="alert" style={{ color: '#A34F3E', fontSize: 12 }}>{error}</Text> : null}
      {notice ? <Text style={{ color: green, fontSize: 12, fontWeight: '800' }}>{notice}</Text> : null}
      {loading ? <View style={{ padding: 36, alignItems: 'center' }}><ActivityIndicator color={green} /><Text style={{ color: muted, marginTop: 9 }}>Loading submitted scans…</Text></View> : rows.map((row) => {
        const station = row.stations?.[0];
        const sellerStatus = station?.marketplace_seller_status || 'pending';
        const screening = row.grading_result?.screening;
        const liveEvidence = screening?.source === 'live_inference';
        const pending = row.eligibility_status === 'unreviewed' || row.eligibility_status === 'needs_review';
        return (
          <View key={row.id} style={{ ...panel, padding: 16, gap: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: '#EAF1E8', alignItems: 'center', justifyContent: 'center' }}><Coffee size={18} color={green} /></View>
              <View style={{ flex: 1 }}><Text style={{ color: ink, fontSize: 13, fontWeight: '900' }}>{row.batch_code}</Text><Text style={{ color: muted, fontSize: 10, marginTop: 3 }}>{station?.station_name || station?.name || 'Registered station'} · {row.woreda} · {row.sample_type === 'green_bean' ? 'Green beans' : 'Red cherries'}</Text></View>
              <Text style={{ color: row.eligibility_status === 'eligible' ? green : row.eligibility_status === 'rejected' ? '#A34F3E' : '#9A6A37', fontSize: 10, fontWeight: '900' }}>{row.is_demo ? 'DEMO' : row.eligibility_status.toUpperCase()}</Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
              <Text style={{ color: muted, fontSize: 11 }}>{Number(row.lot_weight_kg).toLocaleString()} kg</Text>
              <Text style={{ color: muted, fontSize: 11 }}>{new Date(row.created_at).toLocaleString()}</Text>
              <Text style={{ color: muted, fontSize: 11 }}>Seller: {sellerStatus}</Text>
              <Text style={{ color: muted, fontSize: 11 }}>Evidence: {liveEvidence ? 'live AI screening' : screening?.source || 'no structured screening'}</Text>
            </View>
            {row.is_demo ? <Text style={{ color: '#A34F3E', fontSize: 11 }}>Demonstration record. It cannot be published as real coffee.</Text> : null}
            {!row.is_demo && sellerStatus !== 'approved' ? <Pressable disabled={busyId === row.id} onPress={() => void approveSeller(row)} style={{ backgroundColor: '#F6EFE3', borderRadius: 11, padding: 11, alignItems: 'center' }}><Text style={{ color: '#805B2D', fontSize: 11, fontWeight: '900' }}>{busyId === row.id ? 'Saving…' : 'Approve marketplace seller'}</Text></Pressable> : null}
            {!row.is_demo && pending ? <>
              <Text style={{ color: ink, fontSize: 11, fontWeight: '800' }}>Public price (ETB / kg)</Text>
              <TextInput value={prices[row.id] || ''} onChangeText={(value) => setPrices((old) => ({ ...old, [row.id]: value }))} keyboardType="decimal-pad" placeholder="Enter approved selling price" style={{ borderWidth: 1, borderColor: '#E5E9E0', borderRadius: 11, padding: 11, color: ink }} />
              <Text style={{ color: ink, fontSize: 11, fontWeight: '800' }}>Administrator review note</Text>
              <TextInput value={reasons[row.id] || ''} onChangeText={(value) => setReasons((old) => ({ ...old, [row.id]: value }))} placeholder="Record the basis for your decision (minimum 10 characters)" multiline style={{ borderWidth: 1, borderColor: '#E5E9E0', borderRadius: 11, padding: 11, color: ink, minHeight: 64 }} />
              <View style={{ flexDirection: 'row', gap: 9 }}>
                <Pressable disabled={busyId === row.id || sellerStatus !== 'approved' || !liveEvidence} onPress={() => void decide(row, 'eligible')} style={{ flex: 1, backgroundColor: sellerStatus === 'approved' && liveEvidence ? green : '#AAB3A8', borderRadius: 11, padding: 12, alignItems: 'center' }}><Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>{busyId === row.id ? 'Processing…' : 'Approve & publish'}</Text></Pressable>
                <Pressable disabled={busyId === row.id} onPress={() => void decide(row, 'rejected')} style={{ backgroundColor: '#F7EAE5', borderRadius: 11, paddingHorizontal: 16, justifyContent: 'center' }}><Text style={{ color: '#A34F3E', fontSize: 11, fontWeight: '900' }}>Reject</Text></Pressable>
              </View>
              {!liveEvidence ? <Text style={{ color: '#9A6A37', fontSize: 10 }}>This record has no live screening evidence. It must be reassessed with a real scan before public publication.</Text> : null}
            </> : null}
            {row.eligibility_status === 'eligible' ? <Text style={{ color: green, fontSize: 11, fontWeight: '800' }}>Approved. Check the public marketplace listing status below.</Text> : null}
          </View>
        );
      })}
      {!loading && !rows.length ? <Text style={{ color: muted, padding: 20, textAlign: 'center' }}>No scans have been submitted yet.</Text> : null}
    </View>
  );
}
