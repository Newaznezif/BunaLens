import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { CoffeeBatch, Station } from '@/types';
import { getDemoAssessment } from '@/constants/demoSamples';
import { priceAssessment } from '@/services/pricing';
import { supabase, isSupabaseConfigured } from '@/services/supabaseClient';

const STORAGE_KEYS = ['bunalens.station', 'bunalens.batches'] as const;

export const DEMO_STATION_SEED: Station = {
  id: 'station-demo',
  name: 'Gomma Coffee Washing Station',
  woreda: 'Gomma',
  manager: 'Station Manager',
  credits: 10,
  feresula_price_etb: 6200,
};

interface StationContextValue {
  station: Station;
  batches: CoffeeBatch[];
  setStation: (station: Station) => void;
  addBatch: (batch: CoffeeBatch) => void;
  addCredits: (amount: number) => void;
  consumeCredit: () => boolean;
  refreshCloudBatches: (targetStationId?: string) => Promise<void>;
  isCloudConnected: boolean;
  isLoadingBatches: boolean;
}

const StationContext = createContext<StationContextValue | null>(null);

export function StationProvider({ children }: { children: React.ReactNode }) {
  const [station, setStationState] = useState<Station>(DEMO_STATION_SEED);
  const [batches, setBatches] = useState<CoffeeBatch[]>([]);
  const [isLoadingBatches, setIsLoadingBatches] = useState<boolean>(false);
  const activeStationId = useRef<string>(station.id);
  activeStationId.current = station.id;

  const setStation = useCallback((next: Station) => {
    setStationState(next);
    void AsyncStorage.setItem(STORAGE_KEYS[0], JSON.stringify(next));
  }, []);

  const addBatch = useCallback((batch: CoffeeBatch) => {
    setBatches((current) => {
      const next = [batch, ...current.filter((item) => item.id !== batch.id)];
      void AsyncStorage.setItem(STORAGE_KEYS[1], JSON.stringify(next));
      return next;
    });
  }, []);

  const addCredits = useCallback((amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setStationState((current) => {
      const updated = { ...current, credits: current.credits + Math.floor(amount) };
      void AsyncStorage.setItem(STORAGE_KEYS[0], JSON.stringify(updated));
      return updated;
    });
  }, []);

  const consumeCredit = useCallback(() => {
    let success = false;
    setStationState((current) => {
      if (current.credits < 1) {
        success = false;
        return current;
      }
      success = true;
      const updated = { ...current, credits: current.credits - 1 };
      void AsyncStorage.setItem(STORAGE_KEYS[0], JSON.stringify(updated));
      return updated;
    });
    return success;
  }, []);

  /**
   * Safely synchronizes and restores cloud coffee batch records from Supabase
   * without overwriting newer local pending/demo batches.
   */
  const refreshCloudBatches = useCallback(async (targetStationId?: string) => {
    const stationId = targetStationId || activeStationId.current;
    const client = supabase;
    if (!client || !isSupabaseConfigured || !stationId || stationId === 'station-demo') {
      return;
    }

    setIsLoadingBatches(true);
    try {
      const { data, error } = await client
        .from('coffee_batches')
        .select('*')
        .eq('station_id', stationId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        console.warn('Could not fetch cloud batches:', error.message);
        return;
      }

      if (!Array.isArray(data)) return;

      setBatches((currentBatches) => {
        // Map cloud database records to CoffeeBatch objects
        const cloudBatches: CoffeeBatch[] = data.map((row: any) => {
          const localMatch = currentBatches.find((b) => b.id === row.id || (row.idempotency_key && b.id === row.idempotency_key));
          let imageUri = localMatch?.image_uri;

          if (!imageUri && row.image_path) {
            const publicUrl = client.storage.from('coffee-samples').getPublicUrl(row.image_path).data?.publicUrl;
            if (publicUrl) imageUri = publicUrl;
          }

          const hasGps = Number.isFinite(Number(row.gps_latitude)) && Number.isFinite(Number(row.gps_longitude));

          return {
            id: row.id,
            batch_code: row.batch_code,
            sample_type: row.sample_type,
            woreda: row.woreda,
            created_at: row.created_at,
            lot_weight_kg: Number(row.lot_weight_kg),
            result: row.grading_result,
            pricing: row.pricing_result || undefined,
            status: 'synced' as const,
            station_id: row.station_id,
            verification_id: row.verification_id,
            image_uri: imageUri,
            origin_coordinates: hasGps ? { latitude: Number(row.gps_latitude), longitude: Number(row.gps_longitude) } : undefined,
          };
        });

        // Merge: keep all demo, local or pending batches from this device that aren't yet cloud records
        const cloudIds = new Set(cloudBatches.map((b) => b.id));
        const localOnlyBatches = currentBatches.filter((b) => !cloudIds.has(b.id) && (b.status === 'demo' || b.status === 'queued' || b.status === 'local'));

        const merged = [...localOnlyBatches, ...cloudBatches].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );

        void AsyncStorage.setItem(STORAGE_KEYS[1], JSON.stringify(merged));
        return merged;
      });
    } catch (err) {
      console.warn('Failed to synchronize cloud batches:', err);
    } finally {
      setIsLoadingBatches(false);
    }
  }, []);

  // Initialize from AsyncStorage on boot
  useEffect(() => {
    let active = true;

    AsyncStorage.multiGet([...STORAGE_KEYS])
      .then(async (values) => {
        if (!active) return;
        const stationValue = values[0]?.[1];
        const batchesValue = values[1]?.[1];

        if (stationValue) {
          try {
            const parsed = JSON.parse(stationValue) as Station;
            setStationState(parsed);
          } catch {
            /* retain demo defaults */
          }
        }

        if (batchesValue) {
          try {
            setBatches(JSON.parse(batchesValue) as CoffeeBatch[]);
          } catch {
            /* retain empty history */
          }
        } else if (!stationValue || (() => { try { return (JSON.parse(stationValue) as Station).id === 'station-demo'; } catch { return true; } })()) {
          // First-run sample records are explicitly marked DEMO and excluded from live AI metrics.
          const now = Date.now();
          const demoBatches: CoffeeBatch[] = [
            { id: 'demo-seed-clean', batch_code: 'BNL-JMA-DEMO1', sample_type: 'green_bean', woreda: 'Gomma', created_at: new Date(now - 86400000).toISOString(), result: getDemoAssessment(false, 'green_bean'), lot_weight_kg: 170, status: 'demo', station_id: 'station-demo', pricing: priceAssessment('green_bean', 'Grade 1', 170), verification_id: 'demo-seed-clean' },
            { id: 'demo-seed-defective', batch_code: 'BNL-JMA-DEMO2', sample_type: 'red_cherry', woreda: 'Limmu Kossa', created_at: new Date(now - 43200000).toISOString(), result: getDemoAssessment(true, 'red_cherry'), lot_weight_kg: 170, status: 'demo', station_id: 'station-demo', pricing: priceAssessment('red_cherry', 'Grade 3', 170), verification_id: 'demo-seed-defective' },
          ];
          setBatches(demoBatches);
          await AsyncStorage.setItem(STORAGE_KEYS[1], JSON.stringify(demoBatches));
        }
      })
      .catch(() => undefined);

    return () => { active = false; };
  }, []);

  // Supabase Auth session synchronization
  useEffect(() => {
    const client = supabase;
    if (!client || !isSupabaseConfigured) return;

    let active = true;

    const loadSessionStation = async () => {
      try {
        const { data: sessionData } = await client.auth.getSession();
        const user = sessionData.session?.user;
        if (!user || !active) return;

        const { data: stationRecord } = await client
          .from('stations')
          .select('id, name, manager, woreda, credits, pro_expires_at, phone, email')
          .eq('owner_id', user.id)
          .maybeSingle();

        if (stationRecord && active) {
          const loadedStation: Station = {
            id: stationRecord.id,
            name: stationRecord.name || 'My Coffee Station',
            manager: stationRecord.manager || user.email || 'Station Manager',
            woreda: stationRecord.woreda || 'Gomma',
            credits: Number(stationRecord.credits || 0),
            feresula_price_etb: 6200,
            pro_expires_at: stationRecord.pro_expires_at || undefined,
            contact_phone: stationRecord.phone || undefined,
            contact_email: stationRecord.email || undefined,
          };
          setStation(loadedStation);
          void refreshCloudBatches(stationRecord.id);
        }
      } catch (err) {
        console.warn('Could not restore auth station session:', err);
      }
    };

    void loadSessionStation();

    const { data: authListener } = client.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;

      if (event === 'SIGNED_IN' && session?.user) {
        try {
          const { data: stationRecord } = await client
            .from('stations')
            .select('id, name, manager, woreda, credits, pro_expires_at, phone, email')
            .eq('owner_id', session.user.id)
            .maybeSingle();

          if (stationRecord && active) {
            const loadedStation: Station = {
              id: stationRecord.id,
              name: stationRecord.name || 'My Coffee Station',
              manager: stationRecord.manager || session.user.email || 'Station Manager',
              woreda: stationRecord.woreda || 'Gomma',
              credits: Number(stationRecord.credits || 0),
              feresula_price_etb: 6200,
              pro_expires_at: stationRecord.pro_expires_at || undefined,
              contact_phone: stationRecord.phone || undefined,
              contact_email: stationRecord.email || undefined,
            };
            setStation(loadedStation);
            void refreshCloudBatches(stationRecord.id);
          }
        } catch (err) {
          console.warn('onAuthStateChange station load failed:', err);
        }
      } else if (event === 'SIGNED_OUT') {
        if (active) {
          setStation(DEMO_STATION_SEED);
        }
      }
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, [refreshCloudBatches, setStation]);

  const isCloudConnected = station.id !== 'station-demo';

  const value = useMemo(
    () => ({
      station,
      batches,
      setStation,
      addBatch,
      addCredits,
      consumeCredit,
      refreshCloudBatches,
      isCloudConnected,
      isLoadingBatches,
    }),
    [station, batches, setStation, addBatch, addCredits, consumeCredit, refreshCloudBatches, isCloudConnected, isLoadingBatches],
  );

  return <StationContext.Provider value={value}>{children}</StationContext.Provider>;
}

export function useStation(): StationContextValue {
  const value = useContext(StationContext);
  if (!value) throw new Error('useStation must be used inside StationProvider.');
  return value;
}
