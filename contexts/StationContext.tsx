import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { CoffeeBatch, Station } from '@/types';

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
    AsyncStorage.multiGet([...STORAGE_KEYS])
      .then((values) => {
        if (!active) return;
        const stationValue = values[0]?.[1];
        const batchesValue = values[1]?.[1];
        if (stationValue) {
          try { setStationState(JSON.parse(stationValue) as Station); } catch { /* retain demo defaults */ }
        }
        if (batchesValue) {
          try { setBatches(JSON.parse(batchesValue) as CoffeeBatch[]); } catch { /* retain empty history */ }
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
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
