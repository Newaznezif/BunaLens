import type { GradingResult, SampleType } from '@/types';
import { getSupabaseAccessToken } from '@/services/supabaseClient';

const PROXY_URL = process.env.EXPO_PUBLIC_GEMINI_PROXY_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function validateResult(value: unknown): GradingResult {
  if (!value || typeof value !== 'object') throw new Error('The grading service returned invalid data.');
  const v = value as Partial<GradingResult>;
  if (typeof v.is_coffee_sample !== 'boolean') throw new Error('Missing coffee-sample classification.');
  if (!['Grade 1','Grade 2','Grade 3','Grade 4','Undergrade'].includes(String(v.ecx_grade))) throw new Error('Invalid grade in response.');
  if (typeof v.quality_score !== 'number' || !Number.isFinite(v.quality_score) || v.quality_score < 0 || v.quality_score > 100) throw new Error('Invalid quality score.');
  if (!v.breakdown) throw new Error('Missing defect breakdown.');
  const values = Object.values(v.breakdown);
  if (values.length !== 5 || values.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100)) throw new Error('Invalid defect percentages.');
  if (Math.abs(values.reduce((a,n) => a + n, 0) - 100) > 2) throw new Error('Defect percentages must total approximately 100%.');
  if (!['Specialty Export','Commercial Export','Local Market Only','Reject / Re-sort'].includes(String(v.export_readiness))) throw new Error('Invalid export readiness classification.');
  return v as GradingResult;
}

/** Calls the authenticated Supabase Edge Function. Gemini credentials remain server-side. */
export async function gradeCoffeeImage(base64: string, sampleType: SampleType, woreda: string, stationId: string, mimeType = 'image/jpeg'): Promise<GradingResult> {
  if (!PROXY_URL) throw new Error('AI grading is not configured. Add EXPO_PUBLIC_GEMINI_PROXY_URL or use a clearly labelled demo sample.');
  if (!SUPABASE_ANON_KEY) throw new Error('Cloud authentication is not configured. Add the Supabase public anon key.');
  const token = await getSupabaseAccessToken();
  if (!token) throw new Error('Sign in to a BunaLens station account before submitting a real sample for AI grading.');
  const response = await fetch(PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    body: JSON.stringify({ imageBase64: base64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s/g, ''), mimeType, sampleType, woreda, stationId }),
  });
  const payload = await response.json().catch(() => ({})) as { result?: unknown; error?: string };
  if (!response.ok) throw new Error(payload.error || 'AI grading service failed (HTTP ' + response.status + ').');
  return validateResult(payload.result);
}
