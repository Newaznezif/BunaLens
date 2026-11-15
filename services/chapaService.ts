import * as WebBrowser from 'expo-web-browser';
import { getSupabaseAccessToken } from '@/services/supabaseClient';
export type ChapaPackage='starter_50'|'station_pro_monthly';
export const CHAPA_PACKAGES={
 starter_50:{id:'starter_50',name:'Starter Pack',amount_etb:500,credits:50},
 station_pro_monthly:{id:'station_pro_monthly',name:'Washing Station Unlimited',amount_etb:2500,period_days:30}
} as const;
export async function startChapaCheckout(packageId:ChapaPackage,stationId:string):Promise<'sandbox'|'external'>{
 const endpoint=process.env.EXPO_PUBLIC_CHAPA_INITIALIZE_URL;
 if(!endpoint)return 'sandbox';
 const token=await getSupabaseAccessToken();
 const anonKey=process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
 if(!token||!anonKey)throw new Error('Sign in to a registered station before starting a real Chapa payment.');
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',apikey:anonKey,Authorization:'Bearer '+token},body:JSON.stringify({packageId,stationId,idempotencyKey:'bunalens-'+stationId+'-'+packageId+'-'+Date.now()})});
 const data=await response.json().catch(()=>({})) as {checkout_url?:string;error?:string};
 if(!response.ok)throw new Error(data.error||'Checkout initialization failed. No credits were added.');
 if(!data.checkout_url)throw new Error('The payment service did not return a checkout URL.');
 await WebBrowser.openBrowserAsync(data.checkout_url);
 return 'external';
}
