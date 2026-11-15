import { supabase } from '@/services/supabaseClient';
import type { CoffeeBatch } from '@/types';

export async function persistCoffeeBatch(batch: CoffeeBatch): Promise<{ persisted: boolean; verificationId?: string }> {
  if (!supabase || !/^[0-9a-f-]{36}$/i.test(batch.station_id)) return { persisted: false };
  let imagePath: string | null = null;
  if (batch.image_uri) {
    const ext = batch.image_uri.split('?')[0].split('.').pop()?.toLowerCase();
    const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
    const response = await fetch(batch.image_uri);
    if (!response.ok) throw new Error('Could not read the captured image for cloud storage.');
    const bytes = await response.arrayBuffer();
    imagePath = batch.station_id + '/' + batch.id + '.' + (contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg');
    const { error: uploadError } = await supabase.storage.from('coffee-samples').upload(imagePath, bytes, { contentType, upsert: true });
    if (uploadError) throw uploadError;
  }
  const { data, error } = await supabase.from('coffee_batches').insert({
    id: batch.id,
    station_id: batch.station_id,
    batch_code: batch.batch_code,
    sample_type: batch.sample_type,
    woreda: batch.woreda,
    lot_weight_kg: batch.lot_weight_kg,
    image_path: imagePath,
    gps_latitude: batch.origin_coordinates?.latitude ?? null,
    gps_longitude: batch.origin_coordinates?.longitude ?? null,
    grading_result: batch.result,
    pricing_result: batch.pricing ?? null,
    idempotency_key: batch.id,
    created_at: batch.created_at,
  }).select('verification_id').single();
  if (error) {
    if (imagePath) await supabase.storage.from('coffee-samples').remove([imagePath]).catch(() => undefined);
    if (error.code === '23505') {
      const existing = await supabase.from('coffee_batches').select('verification_id').eq('id', batch.id).maybeSingle();
      if (existing.data?.verification_id) return { persisted: true, verificationId: existing.data.verification_id };
    }
    throw error;
  }
  return { persisted: true, verificationId: data.verification_id };
}
