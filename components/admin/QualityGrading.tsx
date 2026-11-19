import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AlertCircle, CheckCircle2, ClipboardCheck, Plus, RefreshCw, ShieldAlert, Trash2 } from 'lucide-react-native';
import { supabase } from '@/services/supabaseClient';

type Rule = { label: string; min_score: number; max_score: number; description: string };
type RuleSet = { id: string; version: number; name: string; description: string; rules: Rule[]; status: 'draft' | 'active' | 'archived'; created_at: string; activated_at: string | null };
type Assessment = { id: string; batch_code: string; sample_type: string; woreda: string; ecx_grade: string; quality_score: number | null; confidence_score: number | null; grading_status: string; grading_result: Record<string, any>; created_at: string; grading_results: { breakdown: Record<string, any>; export_readiness: string; assessment_method: string; model_version: string | null }[] | null };

const ink = '#26372D', muted = '#778174', green = '#55765D';
const panel = { backgroundColor: '#FFFFFF', borderColor: '#E5E9E0', borderWidth: 1, borderRadius: 16 } as const;
const dateLabel = (v?: string | null) => v ? new Date(v).toLocaleString() : '—';

function Metric({ label, value, note }: { label: string; value: string | number; note: string }) {
  return <View style={{ ...panel, padding: 14, flexGrow: 1, flexBasis: 150 }}><Text style={{ color: muted, fontSize: 10, fontWeight: '700' }}>{label}</Text><Text style={{ color: ink, fontSize: 25, fontWeight: '900', marginTop: 7 }}>{value}</Text><Text style={{ color: muted, fontSize: 9, marginTop: 3 }}>{note}</Text></View>;
}
function Section({ title, detail }: { title: string; detail?: string }) {
  return <View style={{ marginTop: 9, marginBottom: 4 }}><Text style={{ color: ink, fontSize: 14, fontWeight: '900' }}>{title}</Text>{detail ? <Text style={{ color: muted, fontSize: 10, marginTop: 3 }}>{detail}</Text> : null}</View>;
}
function Action({ label, onPress, disabled = false, secondary = false }: { label: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={{ backgroundColor: secondary ? '#EFF3ED' : '#26372D', borderRadius: 9, paddingHorizontal: 12, paddingVertical: 9, opacity: disabled ? 0.45 : 1 }}><Text style={{ color: secondary ? green : '#FFFFFF', fontSize: 10, fontWeight: '900' }}>{label}</Text></Pressable>;
}

export default function QualityGrading() {
  const [sets, setSets] = useState<RuleSet[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draftId, setDraftId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [rules, setRules] = useState<Rule[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newMin, setNewMin] = useState('');
  const [newMax, setNewMax] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const load = useCallback(async (quiet = false) => {
    if (!supabase) { setError('Supabase is not configured.'); setLoading(false); return; }
    if (!quiet) setLoading(true);
    setError('');
    try {
      const [ruleRows, batchRows] = await Promise.all([
        supabase.from('grading_rule_sets').select('*').order('version', { ascending: false }),
        supabase.from('coffee_batches').select('id,batch_code,sample_type,woreda,ecx_grade,quality_score,confidence_score,grading_status,grading_result,created_at,grading_results(breakdown,export_readiness,assessment_method,model_version)').eq('is_demo', false).order('created_at', { ascending: false }).limit(200),
      ]);
      if (ruleRows.error) throw ruleRows.error;
      if (batchRows.error) throw batchRows.error;
      setSets((ruleRows.data || []) as RuleSet[]);
      setAssessments((batchRows.data || []) as Assessment[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Quality and grading data could not be loaded.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase.channel('bunalens-quality-grading')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'coffee_batches' }, () => { void load(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grading_results' }, () => { void load(true); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'grading_rule_sets' }, () => { void load(true); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const active = sets.find((s) => s.status === 'active') || null;
  const draft = sets.find((s) => s.id === draftId && s.status === 'draft') || null;
  const scored = assessments.filter((a) => a.quality_score != null);
  const unclassified = assessments.filter((a) => !a.ecx_grade || a.ecx_grade === 'Unclassified').length;
  const readiness = useMemo(() => {
    const counts = new Map<string, number>();
    assessments.forEach((a) => {
      const key = a.grading_results?.[0]?.export_readiness || a.grading_result?.export_readiness || 'Insufficient Evidence';
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [assessments]);
  const defectTotals = useMemo(() => {
    const totals = new Map<string, { sum: number; count: number }>();
    assessments.forEach((a) => {
      const breakdown = a.grading_results?.[0]?.breakdown || a.grading_result?.breakdown || {};
      Object.entries(breakdown).forEach(([key, value]) => {
        if (typeof value !== 'number' || !key.endsWith('_pct')) return;
        const current = totals.get(key) || { sum: 0, count: 0 };
        current.sum += value; current.count += 1; totals.set(key, current);
      });
    });
    return [...totals.entries()].map(([key, value]) => ({ key, avg: value.sum / value.count })).sort((a, b) => b.avg - a.avg);
  }, [assessments]);

  const startDraft = async () => {
    if (!supabase || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const nextVersion = Math.max(0, ...sets.map((s) => s.version)) + 1;
      const { data: userData } = await supabase.auth.getUser();
      const { data, error: insertError } = await supabase.from('grading_rule_sets').insert({
        version: nextVersion, name: `Draft v${nextVersion}`,
        description: 'Internal BunaLens visual-screening rules. Not an official ECX grading standard.',
        rules: active?.rules || [], status: 'draft', created_by: userData.user?.id || null,
      }).select('*').single();
      if (insertError) throw insertError;
      const created = data as RuleSet;
      setSets((current) => [created, ...current]); setDraftId(created.id);
      setDraftName(created.name); setDraftDescription(created.description); setRules(created.rules || []);
      setNotice(`Draft version ${created.version} created. The active version remains unchanged.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not create a draft.'); }
    finally { setSaving(false); }
  };

  const openDraft = (set: RuleSet) => {
    setDraftId(set.id); setDraftName(set.name); setDraftDescription(set.description); setRules(set.rules || []);
    setNotice(`Editing draft version ${set.version}. Save before activating.`);
  };

  const saveDraft = async () => {
    if (!supabase || !draft || saving) return;
    if (draftName.trim().length < 2) { setError('Give this rule set a name of at least 2 characters.'); return; }
    const sorted = [...rules].sort((a, b) => a.min_score - b.min_score);
    for (let i = 0; i < sorted.length; i++) {
      const rule = sorted[i];
      if (!rule.label.trim() || !Number.isFinite(rule.min_score) || !Number.isFinite(rule.max_score) || rule.min_score < 0 || rule.max_score > 100 || rule.min_score > rule.max_score) {
        setError('Each band needs a label and valid score limits between 0 and 100.'); return;
      }
      if (i > 0 && sorted[i - 1].max_score >= rule.min_score) { setError('Score bands cannot overlap. Adjust the minimum or maximum score.'); return; }
    }
    setSaving(true); setError(''); setNotice('');
    try {
      const { error: updateError } = await supabase.from('grading_rule_sets').update({ name: draftName.trim(), description: draftDescription.trim(), rules: sorted }).eq('id', draft.id).eq('status', 'draft');
      if (updateError) throw updateError;
      await load(true); setNotice(`Draft version ${draft.version} saved. It has not been applied to assessments.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Draft could not be saved.'); }
    finally { setSaving(false); }
  };

  const activateDraft = async () => {
    if (!supabase || !draft || saving) return;
    if (!draft.rules.length && !rules.length) { setError('Add at least one score band before activating this rule set.'); return; }
    await saveDraft();
    setSaving(true); setError(''); setNotice('');
    try {
      const { error: rpcError } = await supabase.rpc('activate_grading_rule_set', { p_rule_set_id: draft.id });
      if (rpcError) throw rpcError;
      setDraftId(null); await load(true);
      setNotice(`Rule set version ${draft.version} is now active. Existing assessments were not changed.`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Rule set could not be activated.'); }
    finally { setSaving(false); }
  };

  const addRule = () => {
    const min = Number(newMin), max = Number(newMax);
    if (!newLabel.trim() || newMin === '' || newMax === '' || !Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max > 100 || min > max) {
      setError('Enter a label and a valid minimum/maximum score from 0 to 100.'); return;
    }
    setRules((current) => [...current, { label: newLabel.trim(), min_score: min, max_score: max, description: newDescription.trim() }]);
    setNewLabel(''); setNewMin(''); setNewMax(''); setNewDescription(''); setError('');
  };

  const updateRule = (index: number, patch: Partial<Rule>) => setRules((current) => current.map((r, i) => i === index ? { ...r, ...patch } : r));

  return <View style={{ gap: 13 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
      <View style={{ flex: 1 }}><Text style={{ color: ink, fontSize: 18, fontWeight: '900' }}>Quality & Grading</Text><Text style={{ color: muted, fontSize: 10, marginTop: 4 }}>Assessment quality, defect signals and versioned internal grading rules.</Text></View>
      <Pressable onPress={() => void load(true)} style={{ padding: 9, borderWidth: 1, borderColor: '#DDE4DA', borderRadius: 9, flexDirection: 'row', gap: 6, alignItems: 'center' }}><RefreshCw size={13} color={green} /><Text style={{ color: green, fontSize: 9, fontWeight: '900' }}>Refresh</Text></Pressable>
    </View>

    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 9 }}>
      <Metric label="Real assessments" value={assessments.length} note="Latest 200 non-demo batches" />
      <Metric label="Scored samples" value={scored.length} note="Quality score present" />
      <Metric label="Unclassified" value={unclassified} note="No grade mapping recorded" />
      <Metric label="Active rule version" value={active ? `v${active.version}` : 'None'} note={active?.name || 'No active rule set'} />
    </View>

    <View style={{ ...panel, padding: 14, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ShieldAlert size={16} color="#9A6A37" /><Text style={{ color: ink, fontSize: 12, fontWeight: '900' }}>Assessment boundary</Text></View>
      <Text style={{ color: muted, fontSize: 10, lineHeight: 16 }}>BunaLens visual estimates are preliminary screening outputs. These configurable score bands are internal platform rules, not certified ECX grades, export approvals or laboratory measurements. Activating a version does not recalculate or relabel historical batches.</Text>
    </View>

    {error ? <View style={{ ...panel, padding: 11, borderColor: '#E7BDB3', backgroundColor: '#FBF0ED', flexDirection: 'row', gap: 7 }}><AlertCircle size={14} color="#A34F3E" /><Text style={{ color: '#7D3C32', fontSize: 10, flex: 1 }}>{error}</Text></View> : null}
    {notice ? <View style={{ ...panel, padding: 11, borderColor: '#D6E2D2', backgroundColor: '#F0F5EE', flexDirection: 'row', gap: 7 }}><CheckCircle2 size={14} color={green} /><Text style={{ color: green, fontSize: 10, flex: 1 }}>{notice}</Text></View> : null}

    <View style={{ ...panel, padding: 14, gap: 9 }}>
      <Section title="Assessment distribution" detail="Current recorded export-readiness labels; not an independent certification." />
      {readiness.length ? readiness.map(([label, count]) => <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 }}><Text style={{ color: muted, fontSize: 10, flex: 1 }}>{label}</Text><Text style={{ color: ink, fontSize: 11, fontWeight: '900' }}>{count}</Text></View>) : <Text style={{ color: muted, fontSize: 10 }}>No assessment records yet.</Text>}
      <View style={{ height: 1, backgroundColor: '#EEF0EC', marginVertical: 3 }} />
      <Section title="Observed defect signals" detail="Mean reported defect percentages across records where each field exists." />
      {defectTotals.length ? defectTotals.map(({ key, avg }) => <View key={key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}><Text style={{ color: muted, fontSize: 10, flex: 1 }}>{key.replaceAll('_pct', '').replaceAll('_', ' ')}</Text><Text style={{ color: ink, fontSize: 11, fontWeight: '900' }}>{avg.toFixed(1)}%</Text></View>) : <Text style={{ color: muted, fontSize: 10 }}>No numeric defect percentages found in the current assessments.</Text>}
    </View>

    <View style={{ ...panel, padding: 14, gap: 9 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}><View style={{ flex: 1 }}><Section title="Grading rule versions" detail="Create a draft, review its score bands, then activate it explicitly." /></View><Action label="New version" onPress={() => void startDraft()} disabled={saving || !!draft} /></View>
      {loading ? <ActivityIndicator color={green} /> : sets.map((set) => <View key={set.id} style={{ paddingVertical: 10, borderTopWidth: 1, borderColor: '#EEF0EC', gap: 5 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text style={{ color: ink, fontSize: 11, fontWeight: '900', flex: 1 }}>v{set.version} · {set.name}</Text><Text style={{ color: set.status === 'active' ? green : muted, fontSize: 9, fontWeight: '900', textTransform: 'uppercase' }}>{set.status}</Text></View>
        <Text style={{ color: muted, fontSize: 9 }}>{set.rules?.length || 0} score bands · Created {dateLabel(set.created_at)}{set.activated_at ? ` · Activated ${dateLabel(set.activated_at)}` : ''}</Text>
        {set.description ? <Text style={{ color: muted, fontSize: 9, lineHeight: 14 }}>{set.description}</Text> : null}
        {set.rules?.map((r, i) => <Text key={i} style={{ color: '#536054', fontSize: 9 }}>• {r.label}: {r.min_score}–{r.max_score} / 100{r.description ? ` — ${r.description}` : ''}</Text>)}
        {set.status === 'draft' ? <View style={{ alignSelf: 'flex-start', marginTop: 3 }}><Action label={draftId === set.id ? 'Editing this draft' : 'Edit draft'} secondary onPress={() => openDraft(set)} /></View> : null}
      </View>)}
      {!sets.length && !loading ? <Text style={{ color: muted, fontSize: 10 }}>No grading rule sets are configured.</Text> : null}
    </View>

    {draft ? <View style={{ ...panel, padding: 14, gap: 9 }}>
      <Section title={`Edit draft · version ${draft.version}`} detail="Only draft versions can be changed. Active and archived versions are immutable." />
      <TextInput value={draftName} onChangeText={setDraftName} placeholder="Rule set name" placeholderTextColor="#929A91" style={{ borderWidth: 1, borderColor: '#DDE4DA', borderRadius: 9, padding: 10, color: ink, fontSize: 11 }} />
      <TextInput value={draftDescription} onChangeText={setDraftDescription} placeholder="Purpose and limitations" placeholderTextColor="#929A91" multiline style={{ borderWidth: 1, borderColor: '#DDE4DA', borderRadius: 9, padding: 10, color: ink, fontSize: 10, minHeight: 55, textAlignVertical: 'top' }} />
      <Section title="Score bands" detail="Bands use a 0–100 platform score. Avoid overlaps. No bands are prefilled as official grades." />
      {rules.map((rule, index) => <View key={index} style={{ backgroundColor: '#F6F8F4', borderRadius: 10, padding: 10, gap: 6 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><TextInput value={rule.label} onChangeText={(v) => updateRule(index, { label: v })} placeholder="Band label" style={{ flex: 1, color: ink, fontSize: 10, borderBottomWidth: 1, borderColor: '#DDE4DA', padding: 5 }} /><Pressable onPress={() => setRules((current) => current.filter((_, i) => i !== index))}><Trash2 size={15} color="#A34F3E" /></Pressable></View>
        <View style={{ flexDirection: 'row', gap: 8 }}><TextInput value={String(rule.min_score)} keyboardType="decimal-pad" onChangeText={(v) => updateRule(index, { min_score: Number(v) })} placeholder="Min" style={{ flex: 1, color: ink, fontSize: 10, borderWidth: 1, borderColor: '#DDE4DA', borderRadius: 7, padding: 7 }} /><TextInput value={String(rule.max_score)} keyboardType="decimal-pad" onChangeText={(v) => updateRule(index, { max_score: Number(v) })} placeholder="Max" style={{ flex: 1, color: ink, fontSize: 10, borderWidth: 1, borderColor: '#DDE4DA', borderRadius: 7, padding: 7 }} /></View>
        <TextInput value={rule.description} onChangeText={(v) => updateRule(index, { description: v })} placeholder="Optional internal description" style={{ color: muted, fontSize: 9, borderBottomWidth: 1, borderColor: '#E4E9E1', padding: 5 }} />
      </View>)}
      <View style={{ gap: 7, backgroundColor: '#F6F8F4', borderRadius: 10, padding: 10 }}>
        <Text style={{ color: ink, fontSize: 10, fontWeight: '900' }}>Add score band</Text>
        <TextInput value={newLabel} onChangeText={setNewLabel} placeholder="Band label (e.g. Internal tier A)" style={{ borderWidth: 1, borderColor: '#DDE4DA', borderRadius: 7, padding: 8, color: ink, fontSize: 10 }} />
        <View style={{ flexDirection: 'row', gap: 7 }}><TextInput value={newMin} onChangeText={setNewMin} keyboardType="decimal-pad" placeholder="Minimum 0–100" style={{ flex: 1, borderWidth: 1, borderColor: '#DDE4DA', borderRadius: 7, padding: 8, color: ink, fontSize: 10 }} /><TextInput value={newMax} onChangeText={setNewMax} keyboardType="decimal-pad" placeholder="Maximum 0–100" style={{ flex: 1, borderWidth: 1, borderColor: '#DDE4DA', borderRadius: 7, padding: 8, color: ink, fontSize: 10 }} /></View>
        <TextInput value={newDescription} onChangeText={setNewDescription} placeholder="Optional description" style={{ borderWidth: 1, borderColor: '#DDE4DA', borderRadius: 7, padding: 8, color: ink, fontSize: 10 }} />
        <View style={{ alignSelf: 'flex-start' }}><Action label="Add band" onPress={addRule} secondary /></View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}><Action label={saving ? 'Saving…' : 'Save draft'} onPress={() => void saveDraft()} disabled={saving} /><Action label={saving ? 'Working…' : 'Activate version'} onPress={() => void activateDraft()} disabled={saving || !rules.length} /><Action label="Close editor" onPress={() => setDraftId(null)} secondary /></View>
    </View> : null}

    <View style={{ ...panel, padding: 13, gap: 5 }}>
      <Section title="Recent assessments" detail="Latest real batch records; historical labels are displayed as stored." />
      {loading ? <ActivityIndicator color={green} /> : assessments.slice(0, 12).map((a) => <View key={a.id} style={{ borderTopWidth: 1, borderColor: '#EEF0EC', paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <ClipboardCheck size={15} color={green} />
        <View style={{ flex: 1 }}><Text style={{ color: ink, fontSize: 10, fontWeight: '900' }}>{a.batch_code}</Text><Text style={{ color: muted, fontSize: 9, marginTop: 2 }}>{a.woreda} · {a.sample_type.replaceAll('_', ' ')} · {dateLabel(a.created_at)}</Text></View>
        <View style={{ alignItems: 'flex-end' }}><Text style={{ color: ink, fontSize: 10, fontWeight: '900' }}>{a.quality_score == null ? 'No score' : `${Number(a.quality_score).toFixed(1)}/100`}</Text><Text style={{ color: a.ecx_grade === 'Unclassified' ? '#9A6A37' : green, fontSize: 8, fontWeight: '800' }}>{a.ecx_grade || 'Unclassified'}</Text></View>
      </View>)}
      {!assessments.length && !loading ? <Text style={{ color: muted, fontSize: 10 }}>No real assessments found.</Text> : null}
    </View>
  </View>;
}
