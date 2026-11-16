import React, { useRef, useState } from 'react';
import { ScrollView, View, Text, Pressable, ActivityIndicator, Alert, TextInput, Image, Modal, Platform } from 'react-native';
import { router } from 'expo-router';
import { Camera, ImagePlus, ScanLine, Coffee, MapPin, Scale, Info, ShieldCheck, Zap, RotateCcw, ChevronRight } from 'lucide-react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useLanguage } from '@/contexts/LanguageContext';
import { useStation } from '@/contexts/StationContext';
import { useOfflineQueue } from '@/contexts/OfflineQueueContext';
import { JIMMA_WOREDAS } from '@/constants/jimmaData';
import { getDemoAssessment } from '@/constants/demoSamples';
import type { CoffeeBatch, SampleType } from '@/types';
import { submitCoffeeSample } from '@/services/geminiVision';
import { enqueueCapture, isOnline, persistLocalImage } from '@/services/offlineQueue';
import { priceAssessment, KG_PER_FERESULA } from '@/services/pricing';
import { BunaLensTheme as theme } from '@/constants/theme';
import { showAlert } from '@/services/platformAlert';
import LanguageToggle from '@/components/LanguageToggle';

type Preview = { base64: string; uri: string; mimeType: string };

export default function Scan() {
  const { t, language } = useLanguage();
  const { station, addBatch, consumeCredit } = useStation();
  const { refresh: refreshQueue } = useOfflineQueue();
  const [perm, ask] = useCameraPermissions();
  const [type, setType] = useState<SampleType>('green_bean');
  const [woreda, setWoreda] = useState(station.woreda);
  const [busy, setBusy] = useState(false);
  const [feresula, setFeresula] = useState('10');
  const [cam, setCam] = useState<CameraView | null>(null);
  const [flash, setFlash] = useState(false);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);

  const weightInKg = Number(feresula) * KG_PER_FERESULA;
  const validWeight = Number.isFinite(Number(feresula)) && Number(feresula) > 0 && Number(feresula) <= 100000 / KG_PER_FERESULA;

  const capture = async () => {
    if (!perm?.granted) {
      const permission = await ask();
      if (!permission.granted) showAlert(t('enableCamera'), t('cameraPermission'));
      return;
    }
    try {
      const photo = await cam?.takePictureAsync({ base64: true, quality: 0.72, skipProcessing: false });
      if (photo?.base64 && photo.uri) setPreview({ base64: photo.base64, uri: photo.uri, mimeType: 'image/jpeg' });
      else showAlert(t('gradingFailed'), t('cameraHint'));
    } catch (error) {
      showAlert(t('gradingFailed'), error instanceof Error ? error.message : t('gradingFailed'));
    }
  };

  const gallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], base64: true, quality: 0.72 });
    if (!result.canceled && result.assets[0]?.base64 && result.assets[0]?.uri) {
      setPreview({ base64: result.assets[0].base64, uri: result.assets[0].uri, mimeType: result.assets[0].mimeType || 'image/jpeg' });
    }
  };

  const submitPreview = async () => {
    if (!preview) return;
    if (!validWeight) {
      showAlert(t('invalidWeight'), t('invalidWeightHint'));
      return;
    }
    const captureId = 'bunalens-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const batchCode = 'BNL-JMA-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    setBusy(true);
    try {
      if (!(await isOnline())) {
        await enqueueCapture({
          id: captureId, batch_code: batchCode, image_uri: preview.uri, sample_type: type, woreda,
          lot_weight_kg: weightInKg, created_at: new Date().toISOString(),
          station_id: station.id, mime_type: preview.mimeType,
        });
        await refreshQueue();
        setPreview(null);
        showAlert(t('savedForLater'), t('offlineQueue'));
        return;
      }
      if (station.id === 'station-demo') {
        showAlert(t('registerStation'), t('registerStationHint'));
        return;
      }
      const hasPro = Boolean(station.pro_expires_at && new Date(station.pro_expires_at).getTime() > Date.now());
      if (!hasPro && station.credits < 1) {
        showAlert(t('credits'), t('noCreditsHint'));
        return;
      }
      let coordinates: { latitude: number; longitude: number } | undefined;
      // Alert callbacks never fire on React Native Web, which would leave this
      // promise pending and block submission, so browsers use a native confirm.
      const wantsLocation = Platform.OS === 'web'
        ? typeof window !== 'undefined' && window.confirm(t('locationConsentTitle') + '\n\n' + t('locationConsentBody'))
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              t('locationConsentTitle'),
              t('locationConsentBody'),
              [
                { text: t('notNow'), style: 'cancel', onPress: () => resolve(false) },
                { text: t('allowLocation'), onPress: () => resolve(true) },
              ],
              { cancelable: true, onDismiss: () => resolve(false) },
            );
          });
      if (wantsLocation) {
        try {
          const permission = await Location.requestForegroundPermissionsAsync();
          if (permission.granted) {
            const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
            coordinates = { latitude: position.coords.latitude, longitude: position.coords.longitude };
          }
        } catch { /* GPS is optional; the operator can still assess the sample. */ }
      }
      const batch = await submitCoffeeSample(preview.base64, type, woreda, station.id, captureId, weightInKg, preview.mimeType, coordinates, batchCode);
      if (!hasPro) consumeCredit();
      const savedImage = await persistLocalImage(preview.uri, captureId, preview.mimeType).catch(() => preview.uri);
      const finalBatch: CoffeeBatch = { ...batch, image_uri: savedImage, origin_coordinates: coordinates, status: 'synced' };
      addBatch(finalBatch);
      setPreview(null);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.push({ pathname: '/batch/[id]', params: { id: finalBatch.id } });
    } catch (error) {
      const message = error instanceof Error ? error.message : t('gradingFailed');
      const retryable = error instanceof TypeError || message.toLowerCase().includes('temporarily') || message.toLowerCase().includes('timed out') || message.toLowerCase().includes('could not reach');
      if (retryable) {
        try {
          await enqueueCapture({
            id: captureId, batch_code: batchCode, image_uri: preview.uri, sample_type: type, woreda,
            lot_weight_kg: weightInKg, created_at: new Date().toISOString(),
            station_id: station.id, mime_type: preview.mimeType,
          });
          await refreshQueue();
          setPreview(null);
          showAlert(t('savedForRetry'), t('retryHint'));
        } catch { showAlert(t('gradingFailed'), message); }
      } else showAlert(t('gradingFailed'), message);
    } finally {
      setBusy(false);
    }
  };

  const demo = async (defective: boolean) => {
    if (!validWeight) {
      showAlert(t('invalidWeight'), t('invalidWeightHint'));
      return;
    }
    const id = 'demo-' + Date.now();
    try {
      // A captured photograph may be retained with the local demo record for
      // traceability. The preset assessment remains simulated and never claims
      // to have analysed the photograph.
      const savedImage = preview
        ? await persistLocalImage(preview.uri, id, preview.mimeType)
        : undefined;
      const result = getDemoAssessment(defective, type);
      const batch: CoffeeBatch = {
        id, batch_code: 'BNL-JMA-' + String(Date.now()).slice(-4),
        sample_type: type, woreda, created_at: new Date().toISOString(),
        ...(savedImage ? { image_uri: savedImage } : {}),
        result, lot_weight_kg: weightInKg, status: 'demo', station_id: station.id,
        pricing: priceAssessment(type, result.ecx_grade, weightInKg), verification_id: id,
      };
      addBatch(batch);
      setPreview(null);
      setDemoOpen(false);
      router.push({ pathname: '/batch/[id]', params: { id } });
    } catch (error) {
      showAlert(t('gradingFailed'), error instanceof Error ? error.message : t('gradingFailed'));
    }
  };

  return (
    <ScrollView className="flex-1 bg-parchment" contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 20, paddingBottom: 38 }} showsVerticalScrollIndicator={false}>
      <View className="flex-row items-center justify-between mb-6">
        <View>
          <Text className="text-2xl font-black text-espresso">{t('scanTitle')}</Text>
          <Text className="text-xs text-secondary mt-1">{t('scanSubtitle')}</Text>
        </View>
        <LanguageToggle />
      </View>

      <View className="bg-white border border-line rounded-3xl p-4 mb-5">
        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-[10px] font-extrabold tracking-widest text-secondary">{t('assessmentSteps')}</Text>
          <Text className="text-xs font-extrabold text-espresso">{step === 1 ? '1 / 2' : '2 / 2'}</Text>
        </View>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <View className="h-1.5 rounded-full" style={{ backgroundColor: theme.colors.emerald }} />
            <Text className="text-[10px] font-bold text-espresso mt-2">{t('stepSampleDetails')}</Text>
          </View>
          <View className="flex-1">
            <View className="h-1.5 rounded-full" style={{ backgroundColor: step === 2 ? theme.colors.emerald : theme.colors.line }} />
            <Text className="text-[10px] font-bold text-secondary mt-2">{t('stepPhotoAssessment')}</Text>
          </View>
        </View>
      </View>

      {step === 1 ? (
        <>
          <View className="mb-5">
            <Text className="text-xl font-black text-espresso">{t('scanIntroTitle')}</Text>
            <Text className="text-xs text-secondary leading-5 mt-1">{t('scanIntroHint')}</Text>
          </View>

          <Text className="text-sm font-extrabold text-espresso mb-2">{t('selectSampleType')}</Text>
          <View className="flex-row gap-3 mb-6">
            {(['red_cherry', 'green_bean'] as const).map((sample) => (
              <Pressable key={sample} accessibilityRole="button" accessibilityState={{ selected: type === sample }} onPress={() => setType(sample)}
                className={`flex-1 p-4 rounded-3xl border-2 ${type === sample ? 'bg-cherry-soft border-cherry' : 'bg-white border-line'}`}>
                <View className="flex-row items-center justify-between">
                  <Coffee color={type === sample ? theme.colors.cherry : theme.colors.secondary} size={21} />
                  {type === sample ? <ShieldCheck color={theme.colors.cherry} size={17} /> : null}
                </View>
                <Text className="text-sm text-espresso font-extrabold mt-3">{sample === 'red_cherry' ? t('redCherries') : t('greenBeans')}</Text>
                <Text className="text-[10px] text-secondary mt-1">{sample === 'red_cherry' ? t('red') : t('green')}</Text>
              </Pressable>
            ))}
          </View>

          <View className="bg-white border border-line rounded-3xl p-4 mb-4">
            <View className="flex-row items-center mb-3">
              <MapPin size={16} color={theme.colors.emerald} />
              <Text className="text-sm font-extrabold text-espresso ml-2">{t('coffeeOrigin')}</Text>
            </View>
            <Text className="text-[11px] text-secondary mb-3">{t('jimmaZone')} · {t('woreda')}</Text>
            <View className="flex-row flex-wrap">
              {JIMMA_WOREDAS.map((item) => (
                <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: item === woreda }} onPress={() => setWoreda(item)}
                  className={`px-3.5 py-2.5 mr-2 mb-2 rounded-full border ${item === woreda ? 'bg-espresso border-espresso' : 'bg-parchment border-line'}`}>
                  <Text className={`text-xs font-bold ${item === woreda ? 'text-white' : 'text-espresso'}`}>{item}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View className="bg-white border border-line rounded-3xl p-4 mb-5">
            <View className="flex-row items-center mb-2">
              <Scale size={16} color={theme.colors.emerald} />
              <Text className="text-sm font-extrabold text-espresso ml-2">{t('lotSizeFeresula')}</Text>
            </View>
            <TextInput
              accessibilityLabel={t('lotSizeFeresula')}
              keyboardType="decimal-pad"
              value={feresula}
              onChangeText={setFeresula}
              className="bg-parchment border border-line rounded-2xl px-4 py-4 text-espresso font-bold text-base"
              placeholder="10"
              placeholderTextColor={theme.colors.muted}
            />
            <Text className="text-[11px] text-secondary mt-2">{t('feresulaConversion')}: {validWeight ? weightInKg.toLocaleString() : '—'} kg · 1 Feresula = 17 kg</Text>
            {!validWeight ? <Text className="text-[11px] font-semibold mt-2" style={{ color: theme.colors.cherry }}>{t('invalidWeightHint')}</Text> : null}
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!validWeight}
            onPress={() => setStep(2)}
            className="rounded-2xl p-4 flex-row items-center justify-center"
            style={{ backgroundColor: theme.colors.cherry, opacity: validWeight ? 1 : 0.45 }}
          >
            <Text className="text-white font-extrabold mr-2">{t('continueToPhoto')}</Text>
            <ChevronRight size={18} color="#FFFFFF" />
          </Pressable>
        </>
      ) : (
        <>
          <View className="mb-4">
            <Text className="text-xl font-black text-espresso">{t('captureIntroTitle')}</Text>
            <Text className="text-xs text-secondary leading-5 mt-1">{t('captureIntroHint')}</Text>
          </View>

          <View className="bg-emerald-soft border border-line rounded-2xl p-3 mb-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-1">
                <Text className="text-[10px] font-bold text-secondary">{t('sampleSummary')}</Text>
                <Text className="text-sm font-extrabold text-espresso mt-1">{type === 'red_cherry' ? t('redCherries') : t('greenBeans')} · {woreda}</Text>
                <Text className="text-[11px] text-secondary mt-1">{feresula} Feresula · {validWeight ? weightInKg.toLocaleString() : '—'} kg</Text>
              </View>
              <Pressable accessibilityRole="button" onPress={() => setStep(1)} className="px-3 py-2 rounded-full bg-white">
                <Text className="text-xs font-bold text-emerald">{t('editDetails')}</Text>
              </Pressable>
            </View>
          </View>

          <View className="flex-row items-start rounded-2xl p-3 mb-4" style={{ backgroundColor: '#FFF7ED', borderWidth: 1, borderColor: '#FED7AA' }}>
            <Info size={16} color={theme.colors.harvest} />
            <Text className="text-xs ml-2 flex-1 leading-5" style={{ color: '#7C2D12' }}>{t('fieldLighting')}</Text>
          </View>

          <Text className="text-sm font-extrabold text-espresso mb-2">{t('captureSample')}</Text>
          {preview ? (
            <View className="rounded-3xl overflow-hidden bg-white border border-emerald p-3">
              <Image source={{ uri: preview.uri }} resizeMode="contain" style={{ width: '100%', height: 260, borderRadius: 16, backgroundColor: '#292524' }} />
              <View className="flex-row items-center justify-center mt-3">
                <ShieldCheck size={15} color={theme.colors.emerald} />
                <Text className="text-emerald font-bold text-xs ml-2">{t('photoReady')}</Text>
              </View>
              <View className="flex-row gap-2 mt-3">
                <Pressable onPress={() => setPreview(null)} disabled={busy} className="flex-1 bg-parchment p-3.5 rounded-xl flex-row items-center justify-center">
                  <RotateCcw size={16} color={theme.colors.espresso} />
                  <Text className="text-espresso font-bold ml-2">{t('retake')}</Text>
                </Pressable>
                <Pressable onPress={submitPreview} disabled={busy} className="flex-1 p-3.5 rounded-xl flex-row items-center justify-center" style={{ backgroundColor: theme.colors.cherry, opacity: busy ? 0.65 : 1 }}>
                  {busy ? <ActivityIndicator color="white" /> : <><ScanLine size={16} color="white" /><Text className="text-white font-bold ml-2">{t('submitForAssessment')}</Text></>}
                </Pressable>
              </View>
            </View>
          ) : perm?.granted ? (
            <>
              <View className="rounded-3xl overflow-hidden border-2 border-white" style={{ height: 330, backgroundColor: '#1C1917' }}>
                <CameraView ref={setCam} facing="back" flash={flash ? 'on' : 'off'} style={{ flex: 1 }} />
                <View pointerEvents="none" className="absolute inset-5 border-2 border-white/70 rounded-2xl" />
                <View pointerEvents="none" className="absolute left-1/2 top-5 bottom-5" style={{ width: 1, backgroundColor: 'rgba(255,255,255,0.35)' }} />
                <View className="absolute top-3 right-3">
                  <Pressable accessibilityRole="button" accessibilityLabel={t('flash')} onPress={() => setFlash((v) => !v)} className="rounded-full p-3" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
                    <Zap size={18} color={flash ? '#FBBF24' : 'white'} />
                  </Pressable>
                </View>
                <View className="absolute bottom-3 left-3 right-3 rounded-xl px-3 py-2" style={{ backgroundColor: 'rgba(0,0,0,0.62)' }}>
                  <Text className="text-white text-[11px] font-semibold text-center">{t('cameraHint')}</Text>
                </View>
              </View>
              <Pressable accessibilityRole="button" disabled={busy} onPress={capture} className="p-4 rounded-2xl mt-4 items-center flex-row justify-center" style={{ backgroundColor: theme.colors.cherry }}>
                <Camera color="white" size={19} />
                <Text className="text-white font-black ml-2">{t('takePhoto')}</Text>
              </Pressable>
            </>
          ) : (
            <Pressable accessibilityRole="button" onPress={ask} className="h-56 rounded-3xl items-center justify-center px-6" style={{ backgroundColor: theme.colors.espresso }}>
              <Camera color="white" size={36} />
              <Text className="text-white font-extrabold mt-3">{t('enableCamera')}</Text>
              <Text className="text-white/70 text-xs mt-1 text-center">{t('cameraPermission')}</Text>
            </Pressable>
          )}

          {!preview ? (
            <Pressable accessibilityRole="button" onPress={gallery} className="bg-white p-4 rounded-2xl mt-3 border border-line items-center flex-row justify-center">
              <ImagePlus color={theme.colors.espresso} size={18} />
              <Text className="text-espresso font-bold ml-2">{t('chooseGallery')}</Text>
            </Pressable>
          ) : null}

          <Pressable accessibilityRole="button" onPress={() => setDemoOpen(true)} className="mt-6 rounded-2xl border p-4 flex-row items-center justify-between" style={{ backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }}>
            <View className="flex-1">
              <Text className="text-sm font-extrabold" style={{ color: '#92400E' }}>{t('demoTitle')} · {t('demoOnly')}</Text>
              <Text className="text-[11px] mt-1" style={{ color: '#92400E' }}>{t('demoHint')}</Text>
            </View>
            <ChevronRight size={18} color="#92400E" />
          </Pressable>
        </>
      )}

      {busy ? (
        <View className="rounded-2xl p-4 mt-4 flex-row items-center" style={{ backgroundColor: theme.colors.espresso }}>
          <ActivityIndicator color="#FFFFFF" />
          <View className="ml-3 flex-1">
            <Text className="text-white font-bold text-sm">{t('assessmentProgress')}</Text>
            <Text className="text-[10px] text-stone-300 mt-1">{t('pleaseWait')}</Text>
          </View>
        </View>
      ) : null}

      <Modal visible={demoOpen} transparent animationType="slide" onRequestClose={() => setDemoOpen(false)}>
        <View className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
          <View className="rounded-t-3xl p-6" style={{ backgroundColor: theme.colors.parchment }}>
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-lg font-black text-espresso">{t('demoTitle')}</Text>
              <Pressable onPress={() => setDemoOpen(false)}><Text className="text-sm font-bold text-cherry">{t('cancel')}</Text></Pressable>
            </View>
            <Text className="text-[11px] text-secondary mb-4">
              {preview
                ? (language === 'om'
                  ? 'Suuraan kaaftan galmee kana waliin kuufama; garuu qabxiin fi qoodinsi mudaa fakkeenya qophaa’e dha. Suuraan AI’n hin xiinxalamu.'
                  : 'Your captured photo will be saved with this record for reference. The score and defect breakdown are preset demonstration data; the photo is not analysed.')
                : t('demoHint')}
            </Text>
            <Pressable onPress={() => demo(false)} className="bg-emerald p-4 rounded-xl mb-2"><Text className="text-white font-bold">{t('cleanDemo')}</Text></Pressable>
            <Pressable onPress={() => demo(true)} className="bg-harvest p-4 rounded-xl"><Text className="text-white font-bold">{t('defectDemo')}</Text></Pressable>
            <Text className="text-[9px] font-bold text-center mt-4" style={{ color: '#92400E' }}>{t('demoOnly')}</Text>
          </View>
        </View>
      </Modal>

      <View className="flex-row items-start mt-5">
        <ShieldCheck size={13} color={theme.colors.secondary} />
        <Text className="text-[10px] text-secondary ml-2 flex-1 leading-4">{t('disclaimer')} AI-assisted visual assessment — not an official ECX laboratory certificate.</Text>
      </View>
    </ScrollView>
  );
}
