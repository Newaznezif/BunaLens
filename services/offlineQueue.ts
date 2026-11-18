import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import type { CoffeeBatch, SampleType } from '@/types';
import { getSupabaseAccessToken } from '@/services/supabaseClient';
import { validateGradingResult } from '@/services/geminiVision';
import { saveWebImage, getWebImageBase64, deleteWebImage } from '@/services/webImageStorage';

const KEY = 'bunalens.offline.queue';
const QUEUE_DIR = (FileSystem.documentDirectory || '') + 'bunalens-queue/';
const endpoint = process.env.EXPO_PUBLIC_BUNALENS_SYNC_URL;
let syncInProgress = false;

export interface QueuedCapture {
  id: string;
  batch_code?: string;
  image_uri: string;
  sample_type: SampleType;
  woreda: string;
  lot_weight_kg: number;
  created_at: string;
  station_id?: string;
  mime_type?: string;
}

export async function getQueue(): Promise<QueuedCapture[]> {
  try {
    const parsed: unknown = JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
    return Array.isArray(parsed) ? parsed.filter((item) => item && typeof item.id === 'string' && typeof item.image_uri === 'string') as QueuedCapture[] : [];
  } catch { return []; }
}

async function saveQueue(items: QueuedCapture[]) {
  await AsyncStorage.setItem(KEY, JSON.stringify(items));
}

export async function persistLocalImage(uri: string, id: string, mimeType = 'image/jpeg'): Promise<string> {
  if (Platform.OS === 'web') {
    // Browsers expose no document directory. Store in IndexedDB or retain persistent URI.
    try {
      return await saveWebImage(id, uri, mimeType);
    } catch {
      return uri;
    }
  }

  if (!FileSystem.documentDirectory) {
    throw new Error('Local document storage is unavailable.');
  }

  const dir = FileSystem.documentDirectory + 'bunalens-batches/';
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const target = dir + id + '.' + ext;
  const existing = await FileSystem.getInfoAsync(target);
  if (existing.exists) return target;
  await FileSystem.copyAsync({ from: uri, to: target });
  return target;
}

export async function enqueueCapture(item: QueuedCapture) {
  const current = await getQueue();
  if (current.some((queued) => queued.id === item.id)) return;
  if (!Number.isFinite(item.lot_weight_kg) || item.lot_weight_kg <= 0) {
    throw new Error('The queued lot weight is invalid.');
  }

  let storedImageUri = item.image_uri;

  if (Platform.OS === 'web') {
    // On web, persist the image blob in IndexedDB to survive browser refreshes
    try {
      storedImageUri = await saveWebImage(item.id, item.image_uri, item.mime_type || 'image/jpeg');
    } catch (err) {
      console.warn('Could not store image in IndexedDB; retaining memory URI:', err);
      storedImageUri = item.image_uri;
    }
  } else {
    // Native mobile filesystem storage
    if (!FileSystem.documentDirectory) {
      throw new Error('Local document storage is unavailable on this device.');
    }
    await FileSystem.makeDirectoryAsync(QUEUE_DIR, { intermediates: true });
    const extension = item.mime_type === 'image/png' ? 'png' : item.mime_type === 'image/webp' ? 'webp' : 'jpg';
    const destination = QUEUE_DIR + item.id + '.' + extension;
    const existing = await FileSystem.getInfoAsync(destination);
    if (!existing.exists) {
      await FileSystem.copyAsync({ from: item.image_uri, to: destination });
    }
    storedImageUri = destination;
  }

  await saveQueue([{ ...item, image_uri: storedImageUri }, ...current]);
}

export async function assignQueuedStation(stationId: string) {
  const queue = await getQueue();
  await saveQueue(queue.map((item) => !item.station_id || item.station_id === 'station-demo' ? { ...item, station_id: stationId } : item));
}

export async function isOnline() {
  const state = await NetInfo.fetch();
  return Boolean(state.isConnected && state.isInternetReachable !== false);
}

export async function syncQueuedCaptures(): Promise<{ synced: CoffeeBatch[]; remaining: number }> {
  if (syncInProgress) return { synced: [], remaining: (await getQueue()).length };
  syncInProgress = true;
  try {
    if (!endpoint) throw new Error('Offline sync is not configured. Set EXPO_PUBLIC_BUNALENS_SYNC_URL to the coffee-sync Edge Function URL.');
    const token = await getSupabaseAccessToken();
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
    if (!token || !anonKey) throw new Error('Sign in to a registered station before synchronizing queued captures.');
    if (!(await isOnline())) throw new Error('No internet connection.');
    const queue = await getQueue();
    const synced: CoffeeBatch[] = [];
    for (const item of queue) {
      try {
        if (!item.station_id || item.station_id === 'station-demo') break;

        let imageBase64 = '';

        if (Platform.OS === 'web') {
          // Retrieve base64 from IndexedDB or data URL
          const fromDb = await getWebImageBase64(item.id);
          if (fromDb) {
            imageBase64 = fromDb;
          } else if (item.image_uri.startsWith('data:image/')) {
            imageBase64 = item.image_uri.replace(/^data:image\/[a-z0-9.+-]+;base64,/i, '').replace(/\s/g, '');
          } else {
            console.warn('Web queued image missing for capture:', item.id);
            break;
          }
        } else {
          // Native mobile filesystem check
          const info = await FileSystem.getInfoAsync(item.image_uri);
          if (!info.exists) break;
          imageBase64 = await FileSystem.readAsStringAsync(item.image_uri, { encoding: FileSystem.EncodingType.Base64 });
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 45_000);
        let response: Response;
        try {
          response = await fetch(endpoint, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', apikey: anonKey, Authorization: 'Bearer ' + token },
            body: JSON.stringify({
              idempotency_key: item.id, batch_code: item.batch_code, station_id: item.station_id, sample_type: item.sample_type,
              woreda: item.woreda, lot_weight_kg: item.lot_weight_kg, captured_at: item.created_at,
              image_mime_type: item.mime_type || 'image/jpeg', image_base64: imageBase64,
            }),
          });
        } finally { clearTimeout(timeout); }
        if (!response.ok) break;
        let payload: { batch?: CoffeeBatch };
        try { payload = await response.json() as { batch?: CoffeeBatch }; } catch { break; }
        const batch = payload.batch;
        if (!batch?.id || !batch.batch_code || !batch.result || !batch.station_id) break;
        const result = validateGradingResult(batch.result);
        if (!result.is_coffee_sample) break;
        const permanentImage = await persistLocalImage(item.image_uri, item.id, item.mime_type || 'image/jpeg').catch(() => null);
        const completedBatch: CoffeeBatch = { ...batch, result, image_uri: permanentImage || item.image_uri, status: 'synced' };

        // Persist the completed record before acknowledging/removing the queue item.
        try {
          const stored = JSON.parse((await AsyncStorage.getItem('bunalens.batches')) || '[]') as CoffeeBatch[];
          const merged = [completedBatch, ...stored.filter((saved) => saved.id !== completedBatch.id)];
          await AsyncStorage.setItem('bunalens.batches', JSON.stringify(merged));
        } catch {
          break;
        }

        synced.push(completedBatch);
        const latest = await getQueue();
        await saveQueue(latest.filter((queued) => queued.id !== item.id));

        // Cleanup temporary queued storage
        if (Platform.OS === 'web') {
          await deleteWebImage(item.id).catch(() => undefined);
        } else if (permanentImage && permanentImage !== item.image_uri) {
          await FileSystem.deleteAsync(item.image_uri, { idempotent: true }).catch(() => undefined);
        }
      } catch {
        break;
      }
    }
    return { synced, remaining: (await getQueue()).length };
  } finally {
    syncInProgress = false;
  }
}
