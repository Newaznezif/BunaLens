import React,{useState}from'react';
import{ActivityIndicator,Alert,Pressable,ScrollView,Text,TextInput,View}from'react-native';
import{router}from'expo-router';
import{JIMMA_WOREDAS}from'@/constants/jimmaData';import{useLanguage}from'@/contexts/LanguageContext';import LanguageToggle from'@/components/LanguageToggle';
import{useStation}from'@/contexts/StationContext';
import{isSupabaseConfigured,supabase}from'@/services/supabaseClient';import{assignQueuedStation}from'@/services/offlineQueue';

export default function AuthScreen(){
 const{station,setStation}=useStation();const{t}=useLanguage();
 const[email,setEmail]=useState('');const[password,setPassword]=useState('');
 const[name,setName]=useState(station.name);const[manager,setManager]=useState(station.manager);
 const[woreda,setWoreda]=useState(station.woreda);const[mode,setMode]=useState<'signin'|'signup'>('signin');const[busy,setBusy]=useState(false);
 const connect=async()=>{
  if(!supabase){Alert.alert(t('cloudUnavailable'),t('cloudUnavailableHint'));return}
  if(!email.trim()||password.length<8){Alert.alert(t('checkCredentials'),t('checkCredentials'));return}
  setBusy(true);
  try{
   const result=mode==='signin'?await supabase.auth.signInWithPassword({email:email.trim(),password}):await supabase.auth.signUp({email:email.trim(),password,options:{data:{full_name:manager}}});
   if(result.error)throw result.error;
   const user=result.data.user;const session=result.data.session;
   if(!user||!session){Alert.alert(t('confirmEmail'),t('accountCreated'));return}
   const{data:existing,error:lookupError}=await supabase.from('stations').select('id,name,manager,woreda,credits,pro_expires_at').eq('owner_id',user.id).limit(1).maybeSingle();
   if(lookupError)throw lookupError;
   let record=existing;
   if(!record){
    const{data:created,error:createError}=await supabase.from('stations').insert({owner_id:user.id,name:name.trim()||'My Coffee Station',manager:manager.trim()||user.email||'Station Manager',woreda}).select('id,name,manager,woreda,credits,pro_expires_at').single();
    if(createError)throw createError;record=created;
   }
   setStation({id:record.id,name:record.name,manager:record.manager||'Station Manager',woreda:record.woreda,credits:record.credits,feresula_price_etb:station.feresula_price_etb,pro_expires_at:record.pro_expires_at||undefined});await assignQueuedStation(record.id);
   Alert.alert(t('stationConnected'),t('stationReady'));
   router.replace('/(tabs)/station');
  }catch(e){Alert.alert(t('accountError'),e instanceof Error?e.message:t('accountError'))}finally{setBusy(false)}
 };
 const signOut=async()=>{if(!supabase)return;const{error}=await supabase.auth.signOut();if(error)Alert.alert('Sign out failed',error.message);else{setStation({...station,id:'station-demo',credits:10,pro_expires_at:undefined});Alert.alert('Signed out','The app has returned to local demonstration mode.');}};
 return <ScrollView className="flex-1 bg-parchment p-6"><View className="flex-row justify-end mt-8"><LanguageToggle /></View><Text className="text-espresso text-3xl font-black mt-5">{t('accountTitle')}</Text><Text className="text-stone-500 mt-2">{t('accountHint')}</Text>
  {!isSupabaseConfigured?<View className="bg-amber-50 border border-amber-200 rounded-xl p-3 mt-5"><Text className="text-amber-900 text-sm">{t('cloudUnavailableHint')}</Text></View>:null}
  <View className="bg-white rounded-2xl p-4 mt-6 border border-line">
   <View className="flex-row gap-2"><Pressable onPress={()=>setMode('signin')} className={`flex-1 p-3 rounded-lg ${mode==='signin'?'bg-espresso':'bg-parchment'}`}><Text className={mode==='signin'?'text-white text-center font-bold':'text-espresso text-center'}>{t('signIn')}</Text></Pressable><Pressable onPress={()=>setMode('signup')} className={`flex-1 p-3 rounded-lg ${mode==='signup'?'bg-espresso':'bg-parchment'}`}><Text className={mode==='signup'?'text-white text-center font-bold':'text-espresso text-center'}>{t('createAccount')}</Text></Pressable></View>
   <Text className="text-espresso font-bold mt-5">{t('email')}</Text><TextInput value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" placeholder="you@example.com" className="border border-line rounded-xl p-3 mt-2 text-espresso"/>
   <Text className="text-espresso font-bold mt-4">{t('password')}</Text><TextInput value={password} onChangeText={setPassword} secureTextEntry placeholder="At least 8 characters" className="border border-line rounded-xl p-3 mt-2 text-espresso"/>
   {mode==='signup'?<><Text className="text-espresso font-bold mt-4">{t('stationName')}</Text><TextInput value={name} onChangeText={setName} className="border border-line rounded-xl p-3 mt-2 text-espresso"/><Text className="text-espresso font-bold mt-4">{t('manager')}</Text><TextInput value={manager} onChangeText={setManager} className="border border-line rounded-xl p-3 mt-2 text-espresso"/><Text className="text-espresso font-bold mt-4">{t('stationWoreda')}</Text><View className="flex-row flex-wrap mt-2">{JIMMA_WOREDAS.map(w=><Pressable key={w} onPress={()=>setWoreda(w)} className={`p-2 m-1 rounded-full ${w===woreda?'bg-espresso':'bg-parchment'}`}><Text className={w===woreda?'text-white':'text-espresso'}>{w}</Text></Pressable>)}</View></>:null}
   <Pressable disabled={busy||!isSupabaseConfigured} onPress={connect} className="bg-cherry p-4 rounded-xl mt-6">{busy?<ActivityIndicator color="white"/>:<Text className="text-white text-center font-bold">{mode==='signin'?t('signInConnect'):t('createAccountStation')}</Text>}</Pressable>
   <Pressable onPress={signOut} className="p-3 mt-2"><Text className="text-stone-500 text-center">{t('signOut')}</Text></Pressable>
  </View>
 </ScrollView>
}
