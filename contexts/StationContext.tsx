import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { CoffeeBatch, Station } from '@/types';
import { getDemoAssessment } from '@/constants/demoSamples';
import { priceAssessment } from '@/services/pricing';
import { supabase } from '@/services/supabaseClient';

const STORAGE_KEYS = ['bunalens.station', 'bunalens.batches'] as const;
const seed: Station = {
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
}

const StationContext = createContext<StationContextValue | null>(null);

export function StationProvider({ children }: { children: React.ReactNode }) {
  const [station, setStationState] = useState<Station>(seed);
  const [batches, setBatches] = useState<CoffeeBatch[]>([]);

  useEffect(() => {
    let active = true;
    let realtimeChannel: any = null;
    AsyncStorage.multiGet([...STORAGE_KEYS])
      .then(async (values) => {
        if (!active) return;
        const stationValue = values[0]?.[1];
        const batchesValue = values[1]?.[1];
        if (stationValue) {
          try { setStationState(JSON.parse(stationValue) as Station); } catch { /* retain demo defaults */ }
        }
        if (batchesValue) {
          try { setBatches(JSON.parse(batchesValue) as CoffeeBatch[]); } catch { /* retain empty history */ }
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
      .then(async () => {
        const client = supabase;
        if (!active || !client) return;
        const { data: sessionData } = await client.auth.getSession();
        const user = sessionData.session?.user;
        if (!user || !active) return;
        const { data: remoteStation, error } = await client
          .from('stations')
          .select('id,name,manager,woreda,credits,pro_expires_at')
          .eq('owner_id', user.id)
          .limit(1)
          .maybeSingle();
        if (error || !remoteStation || !active) return;
        const hydrated: Station = {
          id: remoteStation.id,
          name: remoteStation.name || 'My Coffee Station',
          manager: remoteStation.manager || 'Station Manager',
          woreda: remoteStation.woreda,
          credits: remoteStation.credits,
          feresula_price_etb: seed.feresula_price_etb,
          pro_expires_at: remoteStation.pro_expires_at || undefined,
        };
        setStationState(hydrated);
        await AsyncStorage.setItem(STORAGE_KEYS[0], JSON.stringify(hydrated));

        // The station's history is cloud-backed. Keep demo/offline-only rows
        // clearly separated, but replace stale local "synced" copies with the
        // authoritative records for this signed-in station.
        const refreshCloudBatches = async () => {
          const { data: cloudRows, error: cloudError } = await client
            .from('coffee_batches')
            .select('id,batch_code,sample_type,woreda,created_at,image_path,gps_latitude,gps_longitude,latitude,longitude,lot_weight_kg,grading_result,pricing_result,verification_id,station_id,is_demo')
            .eq('station_id', remoteStation.id)
            .order('created_at', { ascending: false })
            .limit(500);
          if (cloudError || !cloudRows) return;
          const cloudBatches: CoffeeBatch[] = cloudRows.map((row: any) => ({
            id: row.id,
            batch_code: row.batch_code,
            sample_type: row.sample_type,
            woreda: row.woreda,
            created_at: row.created_at,
            image_path: row.image_path || undefined,
            origin_coordinates: (row.gps_latitude ?? row.latitude) != null && (row.gps_longitude ?? row.longitude) != null &&
              Number.isFinite(Number(row.gps_latitude ?? row.latitude)) && Number.isFinite(Number(row.gps_longitude ?? row.longitude))
              ? { latitude: Number(row.gps_latitude ?? row.latitude), longitude: Number(row.gps_longitude ?? row.longitude) }
              : undefined,
            result: row.grading_result,
            lot_weight_kg: Number(row.lot_weight_kg),
            status: row.is_demo ? 'demo' : 'synced',
            station_id: row.station_id,
            pricing: row.pricing_result || undefined,
            verification_id: row.verification_id || undefined,
          }));
          const cloudIds = new Set(cloudBatches.map((batch) => batch.id));
          setBatches((current) => {
            const localOnly = current.filter((batch) => !cloudIds.has(batch.id) && batch.status !== 'synced');
            const nextBatches = [...cloudBatches, ...localOnly]
              .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            void AsyncStorage.setItem(STORAGE_KEYS[1], JSON.stringify(nextBatches));
            return nextBatches;
          });
        };
        await refreshCloudBatches();
        // Keep the scan history current when this station receives another
        // scan from a second signed-in device.
        realtimeChannel = client
          .channel('coffee-batches-' + remoteStation.id)
          .on('postgres_changes', {
            event: '*', schema: 'public', table: 'coffee_batches',
            filter: 'station_id=eq.' + remoteStation.id,
          }, () => { void refreshCloudBatches(); })
          .subscribe();
        if (!active && realtimeChannel) void client.removeChannel(realtimeChannel);
      })
      .catch(() => undefined);
    return () => {
      active = false;
      if (supabase && realtimeChannel) void supabase.removeChannel(realtimeChannel);
    };
  }, []);

  const setStation = (next: Station) => {
    setStationState(next);
    void AsyncStorage.setItem(STORAGE_KEYS[0], JSON.stringify(next));
  };

  const addBatch = (batch: CoffeeBatch) => {
    setBatches((current) => {
      const next = [batch, ...current.filter((item) => item.id !== batch.id)];
      void AsyncStorage.setItem(STORAGE_KEYS[1], JSON.stringify(next));
      return next;
    });
  };

  const addCredits = (amount: number) => {
    if (!Number.isFinite(amount) || amount <= 0) return;
    setStation({ ...station, credits: station.credits + Math.floor(amount) });
  };

  const consumeCredit = () => {
    if (station.credits < 1) return false;
    setStation({ ...station, credits: station.credits - 1 });
    return true;
  };

  const value = useMemo(
    () => ({ station, batches, setStation, addBatch, addCredits, consumeCredit }),
    [station, batches],
  );

  return <StationContext.Provider value={value}>{children}</StationContext.Provider>;
}

export function useStation(): StationContextValue {
  const value = useContext(StationContext);
  if (!value) throw new Error('useStation must be used inside StationProvider.');
  return value;
}
