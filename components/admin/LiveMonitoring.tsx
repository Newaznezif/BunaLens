import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { Activity, AlertTriangle, CheckCircle2, Clock3, Coffee, Radio, RefreshCw, Wifi, WifiOff } from 'lucide-react-native';
import { supabase } from '@/services/supabaseClient';

type Batch = {
  id: string;
  batch_code: string;
  sample_type: string;
  woreda: string;
  grading_status: string;
  ecx_grade: string;
  quality_score: number | null;
  confidence_score: number | null;
  created_at: string;
  stations?: { name?: string | null; woreda?: string | null }[] | null;
};
type ActivityEvent = {
  id: string;
  user_id: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
type ConnectionState = 'connecting' | 'live' | 'reconnecting' | 'offline';

const panel = { backgroundColor: '#FFFFFF', borderColor: '#E5E9E0', borderWidth: 1, borderRadius: 18 } as const;
const ink = '#26372D';
const muted = '#727C70';
const green = '#55765D';

function Metric({ label, value, detail, icon: Icon, tone = green }: { label: string; value: number; detail: string; icon: React.ComponentType<any>; tone?: string }) {
  return <View style={{ ...panel, padding: 15, flexGrow: 1, flexBasis: 155, minWidth: 135 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: muted, fontSize: 10, fontWeight: '800' }}>{label}</Text>
      <Icon size={16} color={tone} />
    </View>
    <Text style={{ color: ink, fontSize: 27, fontWeight: '900', marginTop: 8 }}>{value.toLocaleString()}</Text>
    <Text style={{ color: muted, fontSize: 9, marginTop: 3 }}>{detail}</Text>
  </View>;
}

function dateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function statusTone(value: string) {
  if (value === 'completed') return { bg: '#EAF1E8', fg: green };
  if (value === 'queued' || value === 'processing') return { bg: '#F6EFE3', fg: '#9A6A37' };
  if (value === 'failed') return { bg: '#F7EAE5', fg: '#A34F3E' };
  return { bg: '#F0F1ED', fg: muted };
}

export default function LiveMonitoring() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [totals, setTotals] = useState({ today: 0, processing: 0, failed: 0, activity24h: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState<ConnectionState>('connecting');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!supabase) {
      setError('Supabase is not configured for this environment.');
      setLoading(false);
      return;
    }
    if (quiet) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [batchRows, activityRows, todayCount, processingCount, failedCount, activityCount] = await Promise.all([
        supabase.from('coffee_batches')
          .select('id,batch_code,sample_type,woreda,grading_status,ecx_grade,quality_score,confidence_score,created_at,stations(name,woreda)')
          .eq('is_demo', false).order('created_at', { ascending: false }).limit(12),
        supabase.from('user_activity_logs')
          .select('id,user_id,event_type,metadata,created_at')
          .order('created_at', { ascending: false }).limit(12),
        supabase.from('coffee_batches').select('id', { count: 'exact', head: true })
          .eq('is_demo', false).gte('created_at', today.toISOString()),
        supabase.from('coffee_batches').select('id', { count: 'exact', head: true })
          .eq('is_demo', false).eq('grading_status', 'processing'),
        supabase.from('coffee_batches').select('id', { count: 'exact', head: true })
          .eq('is_demo', false).eq('grading_status', 'failed'),
        supabase.from('user_activity_logs').select('id', { count: 'exact', head: true })
          .gte('created_at', since24h),
      ]);
      const failed = [batchRows, activityRows, todayCount, processingCount, failedCount, activityCount].find((result) => result.error);
      if (failed?.error) throw failed.error;
      setBatches((batchRows.data || []) as Batch[]);
      setEvents((activityRows.data || []) as ActivityEvent[]);
      setTotals({
        today: todayCount.count || 0,
        processing: processingCount.count || 0,
        failed: failedCount.count || 0,
        activity24h: activityCount.count || 0,
      });
      setLastUpdated(new Date().toISOString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Live monitoring data could not be loaded.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
    if (!supabase) {
      setConnection('offline');
      return;
    }
    setConnection('connecting');
    const channel = supabase.channel('bunalens-admin-live-monitoring')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coffee_batches' }, () => { void load(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_activity_logs' }, () => { void load(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stations' }, () => { void load(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'station_payments' }, () => { void load(true); })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setConnection('live');
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setConnection('reconnecting');
        else if (status === 'CLOSED') setConnection('offline');
      });
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const feed = useMemo(() => {
    const batchItems = batches.map((batch) => ({
      id: 'batch-' + batch.id,
      date: batch.created_at,
      kind: 'batch' as const,
      title: 'Coffee batch submitted',
      detail: batch.batch_code + ' · ' + (batch.stations?.[0]?.name || 'Station not linked') + ' · ' + batch.woreda,
      status: batch.grading_status,
    }));
    const activityItems = events.map((event) => ({
      id: 'event-' + event.id,
      date: event.created_at,
      kind: 'activity' as const,
      title: event.event_type.replaceAll('_', ' '),
      detail: 'Account ' + event.user_id.slice(0, 8) + '…',
      status: '',
    }));
    return [...batchItems, ...activityItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 18);
  }, [batches, events]);

  const connectionLabel = connection === 'live' ? 'Realtime connected' : connection === 'connecting' ? 'Connecting to Realtime' : connection === 'reconnecting' ? 'Realtime reconnecting' : 'Realtime offline';
  const connectionColor = connection === 'live' ? green : connection === 'offline' ? '#A34F3E' : '#9A6A37';

  return <View style={{ gap: 15 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: ink, fontSize: 18, fontWeight: '900' }}>Live Monitoring</Text>
        <Text style={{ color: muted, fontSize: 11, marginTop: 4 }}>Operational events and coffee batch activity from the BunaLens network.</Text>
      </View>
      <Pressable onPress={() => void load(true)} disabled={refreshing} style={{ borderWidth: 1, borderColor: '#DDE4DA', borderRadius: 10, paddingHorizontal: 11, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 6, opacity: refreshing ? 0.6 : 1 }}>
        <RefreshCw size={14} color={green} /><Text style={{ color: green, fontSize: 10, fontWeight: '800' }}>{refreshing ? 'Refreshing' : 'Refresh'}</Text>
      </Pressable>
    </View>

    <View style={{ ...panel, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 }}>
      {connection === 'live' ? <Wifi size={16} color={connectionColor} /> : <WifiOff size={16} color={connectionColor} />}
      <View style={{ flex: 1 }}>
        <Text style={{ color: connectionColor, fontSize: 11, fontWeight: '900' }}>{connectionLabel}</Text>
        <Text style={{ color: muted, fontSize: 9, marginTop: 2 }}>{lastUpdated ? 'Last data refresh: ' + dateTime(lastUpdated) : 'Waiting for the first successful data refresh.'}</Text>
      </View>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: connectionColor }} />
    </View>

    {error ? <View style={{ ...panel, padding: 12, borderColor: '#E7BDB3', backgroundColor: '#FBF0ED' }}>
      <Text style={{ color: '#7D3C32', fontSize: 11 }}>{error}</Text>
    </View> : null}

    {loading ? <View style={{ padding: 38, alignItems: 'center' }}><ActivityIndicator size="large" color={green} /><Text style={{ color: muted, marginTop: 10, fontSize: 11 }}>Loading operational activity…</Text></View> : <>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
        <Metric label="Batches today" value={totals.today} detail="Non-demo batches submitted today" icon={Coffee} />
        <Metric label="In progress" value={totals.processing} detail="Currently marked processing" icon={Clock3} tone="#9A6A37" />
        <Metric label="Failed assessments" value={totals.failed} detail="Batches marked failed" icon={AlertTriangle} tone="#A34F3E" />
        <Metric label="User events · 24h" value={totals.activity24h} detail="Events actually recorded" icon={Activity} />
      </View>

      <View style={{ gap: 9 }}>
        <Text style={{ color: ink, fontSize: 15, fontWeight: '900' }}>Live event feed</Text>
        <Text style={{ color: muted, fontSize: 10 }}>New records appear automatically while the Realtime connection is active.</Text>
        <View style={{ ...panel, overflow: 'hidden' }}>
          {feed.map((item, index) => {
            const tone = item.kind === 'batch' ? statusTone(item.status) : { bg: '#EEF2EC', fg: green };
            return <View key={item.id} style={{ padding: 13, borderBottomWidth: index === feed.length - 1 ? 0 : 1, borderColor: '#EEF0EC', flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: tone.bg, alignItems: 'center', justifyContent: 'center' }}>
                {item.kind === 'batch' ? <Coffee size={15} color={tone.fg} /> : <Activity size={15} color={tone.fg} />}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: ink, fontSize: 11, fontWeight: '900', textTransform: 'capitalize' }}>{item.title}</Text>
                <Text style={{ color: muted, fontSize: 9, marginTop: 3 }}>{item.detail}</Text>
                <Text style={{ color: '#929A91', fontSize: 9, marginTop: 4 }}>{dateTime(item.date)}</Text>
              </View>
              {item.status ? <Text style={{ color: tone.fg, backgroundColor: tone.bg, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 99, fontSize: 8, fontWeight: '900', textTransform: 'capitalize' }}>{item.status}</Text> : null}
            </View>;
          })}
          {!feed.length ? <View style={{ padding: 20, alignItems: 'center' }}>
            <Radio size={20} color={muted} />
            <Text style={{ color: ink, fontSize: 11, fontWeight: '800', marginTop: 8 }}>No recent events</Text>
            <Text style={{ color: muted, fontSize: 10, textAlign: 'center', marginTop: 4 }}>New batch submissions and recorded account events will appear here.</Text>
          </View> : null}
        </View>
      </View>
      <View style={{ ...panel, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <CheckCircle2 size={15} color={green} />
        <Text style={{ color: muted, fontSize: 9, flex: 1, lineHeight: 14 }}>Demo batches are excluded from operational counts. User activity is shown only when the application records an event; last sign-in is not an online-presence indicator.</Text>
      </View>
    </>}
  </View>;
}
