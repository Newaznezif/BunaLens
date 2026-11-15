import type { CoffeeBatch, GradingResult, SampleType } from '@/types';
import { getSupabaseAccessToken } from '@/services/supabaseClient';

const SYNC_URL = process.env.EXPO_PUBLIC_BUNALENS_SYNC_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

function validateResult(value: unknown): value is GradingResult {
  if (!value || typeof value !== 'object') return false;
  const v = value as Partial<GradingResult>;
  if (typeof v.is_coffee_sample !== 'boolean') return false;
  if (!['Grade 1','Grade 2','Grade 3','Grade 4','Undergrade'].includes(String(v.ecx_grade))) return false;
  if (typeof v.quality_score !== 'number' || !Number.isFinite(v.quality_score) || v.quality_score < 0 || v.quality_score > 100) return false;
  if (!v.breakdown) return false;
  const values = Object.values(v.breakdown);
  if (values.length !== 5 || values.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100)) return false;
  if (Math.abs(values.reduce((a,n) => a + n, 0) - 100) > 2) return false;
  return ['Specialty Export','Commercial Export','Local Market Only','Reject / Re-sort'].includes(String(v.export_readiness));
}

export async function submitCoffeeSample(
  base64: string, sampleType: SampleType, woreda: string, stationId: string,
  idempotencyKey: string, lotWeightKg: number, mimeType = 'image/jpeg',
  coordinates?: { latitude: number; longitude: number },
): Promise<CoffeeBatch> {
  if (!SYNC_URL) throw new Error('Cloud grading is not configured. Set EXPO_PUBLIC_BUNALENS_SYNC_URL or use a labelled demo sample.');
  if (!SUPABASE_ANON_KEY) throw new Error('Supabase public credentials are missing.');
  const token = await getSupabaseAccessToken();
  if (!token) throw new Error('Sign in to a registered station before grading a real coffee sample.');
  const response = await fetch(SYNC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: 'Bearer ' + token },
    body: JSON.stringify({
      station_id: stationId, idempotency_key: idempotencyKey, sample_type: sampleType,
      woreda, lot_weight_kg: lotWeightKg, captured_at: new Date().toISOString(),
      image_mime_type: mimeType,
      image_base64: base64.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s/g, ''),
      gps_latitude: coordinates?.latitude, gps_longitude: coordinates?.longitude,
    }),
  });
  const payload = await response.json().catch(() => ({})) as { batch?: CoffeeBatch; error?: string };
  if (!response.ok) throw new Error(payload.error || 'Cloud grading failed (HTTP ' + response.status + ').');
  if (!payload.batch?.id || !payload.batch.batch_code || !validateResult(payload.batch.result)) throw new Error('The cloud service returned an invalid batch record.');
  return payload.batch;
}
