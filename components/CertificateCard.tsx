import React from'react';
import{View,Text,Image}from'react-native';
import QRCode from'react-native-qrcode-svg';
import type{CoffeeBatch}from'@/types';
import BunaLogo from'./BunaLogo';
const VERIFY_BASE=process.env.EXPO_PUBLIC_CERTIFICATE_VERIFY_BASE_URL;
export default function CertificateCard({batch}:{batch:CoffeeBatch}){
 const verificationId=batch.verification_id||batch.id;
 const qrValue=VERIFY_BASE?VERIFY_BASE.replace(/\/$/,'')+'/'+encodeURIComponent(verificationId):'bunalens://verify/'+encodeURIComponent(verificationId);
 const price=batch.pricing;
 return <View className="bg-white border-2 border-espresso rounded-2xl p-5 w-80 items-center">
  <BunaLogo size={52}/>
  <Text className="text-espresso text-xl font-black mt-2">BunaLens</Text>
  <Text className="text-cherry text-xs font-bold">DIGITAL QUALITY ASSESSMENT</Text>
  {batch.image_uri?<Image source={{uri:batch.image_uri}} resizeMode="cover" style={{width:230,height:112,borderRadius:10,marginTop:14}}/>:null}
  <Text className="text-espresso font-black text-lg mt-4">{batch.batch_code}</Text>
  <Text className="text-stone-500 text-center">{batch.sample_type==='red_cherry'?'Red Coffee Cherry · Buna Diimaa':'Green Coffee Bean · Buna Qullaa'}</Text>
  <Text className="text-stone-500">{batch.woreda} · {new Date(batch.created_at).toLocaleString()}</Text>
  <Text className="text-emerald text-2xl font-black mt-3">{batch.result.ecx_grade} · {batch.result.quality_score}/100</Text>
  <Text className="text-stone-500 text-xs mt-1">Lot: {batch.lot_weight_kg} kg</Text>
  {price?<Text className="text-espresso font-bold text-xs text-center mt-2">Indicative value: {price.estimated_lot_value_etb.toLocaleString()} ETB · {price.source_label}</Text>:null}
  <View className="mt-4"><QRCode value={qrValue} size={88}/></View>
  <Text className="text-stone-500 text-[9px] mt-2">Verification ID: {verificationId}</Text>
  <Text className="text-stone-400 text-[9px] text-center mt-3">AI-assisted visual assessment — not an official ECX laboratory certificate or export approval.</Text>
 </View>
}