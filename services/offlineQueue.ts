import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import * as FileSystem from 'expo-file-system/legacy';
import type { CoffeeBatch, SampleType } from '@/types';

const KEY='bunalens.offline.queue';
const QUEUE_DIR=(FileSystem.documentDirectory||'')+'bunalens-queue/';
export interface QueuedCapture{id:string;image_uri:string;sample_type:SampleType;woreda:string;lot_weight_kg:number;created_at:string;station_id?:string;mime_type?:string;}
const endpoint=process.env.EXPO_PUBLIC_BUNALENS_SYNC_URL;

export async function getQueue():Promise<QueuedCapture[]>{
  try{return JSON.parse((await AsyncStorage.getItem(KEY))||'[]') as QueuedCapture[]}catch{return[]}
}
async function saveQueue(items:QueuedCapture[]){await AsyncStorage.setItem(KEY,JSON.stringify(items))}
export async function enqueueCapture(item:QueuedCapture){
  const current=await getQueue();
  if(current.some(x=>x.id===item.id))return;
  if(!FileSystem.documentDirectory)throw new Error('Local document storage is unavailable on this device.');
  await FileSystem.makeDirectoryAsync(QUEUE_DIR,{intermediates:true});
  const extension=item.mime_type==='image/png'?'png':item.mime_type==='image/webp'?'webp':'jpg';
  const destination=QUEUE_DIR+`${item.id}.${extension}`;
  await FileSystem.copyAsync({from:item.image_uri,to:destination});
  await saveQueue([{...item,image_uri:destination},...current]);
}
export async function isOnline(){const s=await NetInfo.fetch();return Boolean(s.isConnected&&s.isInternetReachable!==false)}
export async function syncQueuedCaptures():Promise<{synced:CoffeeBatch[];remaining:number}>{
  if(!endpoint)throw new Error('Offline sync is not configured. Set EXPO_PUBLIC_BUNALENS_SYNC_URL to your authenticated sync endpoint.');
  if(!(await isOnline()))throw new Error('No internet connection.');
  const queue=await getQueue();
  const synced:CoffeeBatch[]=[];
  for(const item of queue){
    try{
      const imageBase64=await FileSystem.readAsStringAsync(item.image_uri,{encoding:FileSystem.EncodingType.Base64});
      const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({idempotency_key:item.id,station_id:item.station_id,sample_type:item.sample_type,woreda:item.woreda,lot_weight_kg:item.lot_weight_kg,captured_at:item.created_at,image_mime_type:item.mime_type||'image/jpeg',image_base64:imageBase64})});
      if(!response.ok)break;
      const payload=await response.json() as {batch?:CoffeeBatch};
      if(!payload.batch?.id||!payload.batch.batch_code||!payload.batch.result)break;
      synced.push(payload.batch);
      const latest=await getQueue();
      await saveQueue(latest.filter(x=>x.id!==item.id));
      await FileSystem.deleteAsync(item.image_uri,{idempotent:true}).catch(()=>undefined);
    }catch{break}
  }
  return {synced,remaining:(await getQueue()).length};
}
