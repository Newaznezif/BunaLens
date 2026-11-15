import * as WebBrowser from 'expo-web-browser';
export type ChapaPackage='starter_50'|'station_pro_monthly';
export const CHAPA_PACKAGES={
 starter_50:{id:'starter_50',name:'Starter Pack',amount_etb:500,credits:50},
 station_pro_monthly:{id:'station_pro_monthly',name:'Washing Station Unlimited',amount_etb:2500,period_days:30}
} as const;
export async function startChapaCheckout(packageId:ChapaPackage,stationId:string):Promise<'sandbox'|'external'>{
 const selected=CHAPA_PACKAGES[packageId];
 const endpoint=process.env.EXPO_PUBLIC_CHAPA_INITIALIZE_URL;
 if(!endpoint)return 'sandbox';
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({package_id:selected.id,station_id:stationId,idempotency_key:'bunalens-'+stationId+'-'+Date.now()})});
 if(!response.ok)throw new Error('Checkout initialization failed. No credits were added.');
 const data=await response.json() as {checkout_url?:string};
 if(!data.checkout_url)throw new Error('The payment service did not return a checkout URL.');
 await WebBrowser.openBrowserAsync(data.checkout_url);
 return 'external';
}
