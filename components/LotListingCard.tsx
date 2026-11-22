import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { CheckCircle2, Circle, ShieldCheck, Store } from 'lucide-react-native';
import { router } from 'expo-router';
import {
  fetchListingForLot, fetchPublicationConsentForLot, recordMarketplacePublicationConsent,
  saveListing, type Listing, type MarketplacePublicationConsent,
} from '@/services/marketplace';

const STATUS: Record<Listing['status'], string> = {
  draft: 'DRAFT · waiting for certification or publication',
  published: 'LIVE ON PUBLIC MARKETPLACE',
  paused: 'PAUSED · hidden from buyers',
  sold_out: 'SOLD OUT',
  withdrawn: 'WITHDRAWN',
};
const field = { flex: 1, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D6D3D1', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, color: '#1C1917' } as const;

/** Station-owner controls for an explicit, auditable marketplace publication decision. */
export default function LotListingCard({
  batchId, lotWeightKg, certificationStatus, certifiedGrade, qualityClassification, eligibilityStatus,
}: {
  batchId: string; lotWeightKg: number; certificationStatus?: string;
  certifiedGrade?: string | null; qualityClassification?: string | null; eligibilityStatus?: string;
}) {
  const [listing, setListing] = useState<Listing | null>(null);
  const [consent, setConsent] = useState<MarketplacePublicationConsent | null>(null);
  const [kg, setKg] = useState(String(lotWeightKg));
  const [price, setPrice] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  const load = useCallback(async () => {
    try {
      const [found, recorded] = await Promise.all([
        fetchListingForLot(batchId), fetchPublicationConsentForLot(batchId),
      ]);
      setListing(found);
      setConsent(recorded);
      if (found) { setKg(String(found.available_kg)); setPrice(String(found.price_per_kg_etb)); }
      else if (recorded) { setKg(String(recorded.available_kg)); setPrice(String(recorded.price_per_kg_etb)); }
      setAgreed(Boolean(recorded?.agreed));
      setUnavailable(false);
    } catch {
      // Buyers and unrelated users cannot see a station's private draft/consent.
      setUnavailable(true);
    }
  }, [batchId]);
  useEffect(() => { void load(); }, [load]);
  if (unavailable) return null;

  const valid = Number(kg) > 0 && Number(kg) <= lotWeightKg && Number(price) > 0 && Number(price) <= 100000;
  const certified = certificationStatus === 'certified' && Boolean(certifiedGrade) && eligibilityStatus === 'eligible';
  const saveDraft = async () => {
    setBusy(true); setMessage(null);
    try {
      const saved = await saveListing(batchId, Number(kg), Number(price), 'draft');
      setListing(saved); setMessage('Draft saved privately. Buyers cannot see it yet.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'The draft could not be saved.'); }
    finally { setBusy(false); }
  };
  const publishWithConsent = async () => {
    if (!agreed) { setMessage('Confirm the seller agreement before continuing.'); return; }
    if (!valid) { setMessage('Enter a valid available quantity and seller-approved price per kilogram.'); return; }
    setBusy(true); setMessage(null);
    try {
      const result = await recordMarketplacePublicationConsent(batchId, true, Number(kg), Number(price));
      await load();
      setMessage(result.message || (result.published ? 'Your lot is now visible to all Marketplace visitors.' : 'Your consent is recorded. The lot will go public after administrator certification.'));
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Your publication agreement could not be saved.'); }
    finally { setBusy(false); }
  };
  const revokeConsent = async () => {
    setBusy(true); setMessage(null);
    try {
      await recordMarketplacePublicationConsent(batchId, false);
      await load();
      setMessage('Publication consent withdrawn. This lot is no longer visible to buyers.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Consent could not be withdrawn.'); }
    finally { setBusy(false); }
  };
  const updateStatus = (status: 'paused' | 'withdrawn') => async () => {
    setBusy(true); setMessage(null);
    try {
      const saved = await saveListing(batchId, Number(kg), Number(price), status);
      setListing(saved); setMessage(status === 'paused' ? 'Listing paused. It is hidden from buyers.' : 'Listing withdrawn.');
    } catch (e) { setMessage(e instanceof Error ? e.message : 'The listing status could not be changed.'); }
    finally { setBusy(false); }
  };

  return (
    <View testID="lot-listing" style={{ backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#DCE6D9', padding: 17, marginBottom: 14 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: '#EAF1E8', alignItems: 'center', justifyContent: 'center', marginRight: 9 }}><Store size={17} color="#55765D" /></View><View><Text style={{ fontSize: 15, fontWeight: '900', color: '#26372D' }}>Marketplace publication</Text><Text style={{ fontSize: 10, color: '#727C70', marginTop: 2 }}>Seller-controlled listing and consent</Text></View></View>
        <Text testID="lot-listing-status" style={{ maxWidth: 150, textAlign: 'right', fontSize: 9, fontWeight: '900', color: listing?.status === 'published' ? '#166534' : '#805B2D' }}>{listing ? STATUS[listing.status] : 'NOT LISTED'}</Text>
      </View>

      <View style={{ backgroundColor: certified ? '#EAF4E8' : '#F7F3EA', borderRadius: 12, padding: 12, marginTop: 13 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}><ShieldCheck size={15} color={certified ? '#166534' : '#805B2D'} /><Text style={{ fontSize: 11, fontWeight: '900', color: certified ? '#166534' : '#805B2D', marginLeft: 7 }}>{certified ? 'ADMINISTRATOR CERTIFIED' : 'AWAITING ADMINISTRATOR CERTIFICATION'}</Text></View>
        {certified ? <Text style={{ fontSize: 11, color: '#26372D', marginTop: 5 }}>{certifiedGrade} · {qualityClassification || 'Quality classification pending'}</Text> : <Text style={{ fontSize: 10, color: '#6B5B45', lineHeight: 15, marginTop: 5 }}>You can record your publication agreement now. The lot will remain private until an administrator certifies it.</Text>}
      </View>

      <Text style={{ fontSize: 11, color: '#57534E', marginTop: 13, marginBottom: 8 }}>Available stock and your asking price are the terms buyers will see. Total registered lot weight: {lotWeightKg.toLocaleString()} kg.</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}><Text style={{ fontSize: 9, color: '#78716C', fontWeight: '800', marginBottom: 4 }}>AVAILABLE KG</Text><TextInput testID="listing-kg" value={kg} onChangeText={setKg} keyboardType="decimal-pad" placeholder="Available kg" placeholderTextColor="#A8A29E" style={field} /></View>
        <View style={{ flex: 1 }}><Text style={{ fontSize: 9, color: '#78716C', fontWeight: '800', marginBottom: 4 }}>PRICE · ETB / KG</Text><TextInput testID="listing-price" value={price} onChangeText={setPrice} keyboardType="decimal-pad" placeholder="ETB per kg" placeholderTextColor="#A8A29E" style={field} /></View>
      </View>

      <Pressable testID="marketplace-consent-checkbox" accessibilityRole="checkbox" accessibilityState={{ checked: agreed }} onPress={() => setAgreed((value) => !value)} style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 14, padding: 12, borderRadius: 12, backgroundColor: '#F6F8F4', borderWidth: 1, borderColor: agreed ? '#55765D' : '#E5E9E0' }}>
        {agreed ? <CheckCircle2 size={19} color="#55765D" /> : <Circle size={19} color="#8A9387" />}
        <Text style={{ flex: 1, fontSize: 11, lineHeight: 17, color: '#26372D', marginLeft: 9 }}>I am authorised to represent this station and agree to publish this coffee lot publicly on BunaLens Marketplace at the price and quantity entered above. I understand buyers can view these details and submit orders.</Text>
      </Pressable>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        <Pressable testID="listing-save-draft" disabled={busy || !valid} onPress={() => void saveDraft()} style={{ backgroundColor: '#44403C', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 11, opacity: busy || !valid ? 0.5 : 1 }}><Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '800' }}>Save private draft</Text></Pressable>
        <Pressable testID="listing-consent-publish" accessibilityRole="button" disabled={busy || !valid || !agreed} onPress={() => void publishWithConsent()} style={{ backgroundColor: busy || !valid || !agreed ? '#AAB3A8' : '#55765D', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 }}><Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '900' }}>{busy ? 'Saving…' : certified ? 'Agree & publish now' : 'Agree to publish after certification'}</Text></Pressable>
        {consent?.agreed ? <Pressable disabled={busy} onPress={() => void revokeConsent()} style={{ backgroundColor: '#F7EAE5', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 }}><Text style={{ color: '#A34F3E', fontSize: 10, fontWeight: '900' }}>Withdraw consent</Text></Pressable> : null}
        {listing?.status === 'published' ? <Pressable disabled={busy} onPress={updateStatus('paused')} style={{ backgroundColor: '#F6EFE3', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 }}><Text style={{ color: '#805B2D', fontSize: 10, fontWeight: '900' }}>Pause listing</Text></Pressable> : null}
      </View>
      {message ? <Text accessibilityLiveRegion="polite" testID="lot-listing-message" style={{ fontSize: 11, lineHeight: 16, color: '#26372D', marginTop: 10 }}>{message}</Text> : null}
      <View style={{ flexDirection: 'row', marginTop: 12 }}>
        <Text onPress={() => router.push('/market/orders')} style={{ color: '#7C2D12', fontWeight: '800', fontSize: 11, marginRight: 16 }}>Incoming orders ›</Text>
        <Text onPress={() => router.push('/(tabs)/marketplace')} style={{ color: '#7C2D12', fontWeight: '800', fontSize: 11 }}>View Marketplace ›</Text>
      </View>
      <Text style={{ fontSize: 9, lineHeight: 14, color: '#78716C', marginTop: 8 }}>Only real, live-screened, administrator-certified lots from approved sellers can be published. Your agreement is recorded with your account, timestamp, price and quantity. You can withdraw consent later.</Text>
    </View>
  );
}
