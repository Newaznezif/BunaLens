import React,{useCallback,useEffect,useState}from'react';
import{View,Text,Pressable,ActivityIndicator,Alert}from'react-native';
import NetInfo from'@react-native-community/netinfo';
import{getQueue,isOnline,syncQueuedCaptures}from'@/services/offlineQueue';
import type{CoffeeBatch}from'@/types';
export default function OfflineBanner({onSynced}:{onSynced?:(batches:CoffeeBatch[])=>void}){
 const[online,setOnline]=useState(true);const[count,setCount]=useState(0);const[busy,setBusy]=useState(false);
 const refresh=useCallback(async()=>{setOnline(await isOnline());setCount((await getQueue()).length)},[]);
 const sync=useCallback(async()=>{if(busy)return;setBusy(true);try{const result=await syncQueuedCaptures();onSynced?.(result.synced);setCount(result.remaining);if(result.synced.length)Alert.alert('Sync complete',`${result.synced.length} queued assessment(s) synchronized.`)}catch(e){Alert.alert('Sync unavailable',e instanceof Error?e.message:'Could not synchronize queued samples.')}finally{setBusy(false);await refresh()}},[busy,onSynced,refresh]);
 useEffect(()=>{void refresh();const unsubscribe=NetInfo.addEventListener(s=>{const connected=Boolean(s.isConnected&&s.isInternetReachable!==false);setOnline(connected);if(connected){void refresh();}});return unsubscribe},[refresh]);
 useEffect(()=>{if(online&&count>0&&!busy){void sync()}},[online,count]);
 if(online&&count===0)return null;
 return <View className={`p-3 rounded-xl border ${online?'bg-emerald-50 border-emerald-200':'bg-amber-50 border-amber-200'}`}>
  <Text className={`font-bold text-xs ${online?'text-emerald-900':'text-amber-900'}`}>{online?'Connection restored':'Offline'} · {count} pending sample(s)</Text>
  {online&&count>0?<Pressable disabled={busy} onPress={sync} className="bg-espresso rounded-lg p-2 mt-2 flex-row justify-center items-center">{busy?<ActivityIndicator color="white"/>:<Text className="text-white font-bold text-xs">Sync queued samples</Text>}</Pressable>:null}
 </View>
}