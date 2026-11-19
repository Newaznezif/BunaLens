import React,{useCallback,useEffect,useState} from 'react';
import {ActivityIndicator,Pressable,Text,TextInput,View} from 'react-native';
import {AlertCircle,CheckCircle2,RefreshCw,ShieldCheck} from 'lucide-react-native';
import {supabase} from '@/services/supabaseClient';
import {DEFAULT_CERTIFICATE_TEMPLATE,type CertificateTemplate} from '@/services/certificateTemplate';
type Row=CertificateTemplate&{id:string;version:number;created_at:string;activated_at:string|null};
const ink='#26372D',muted='#778174',green='#55765D';
const panel={backgroundColor:'#FFFFFF',borderColor:'#E5E9E0',borderWidth:1,borderRadius:16} as const;
const fields:{key:keyof CertificateTemplate;label:string;hint:string;multiline?:boolean}[]=[
{key:'name',label:'Template version name',hint:'BunaLens seasonal certificate'},
{key:'organization_name',label:'Issuer / organization name',hint:'BunaLens'},
{key:'certificate_title',label:'Certificate title',hint:'Main certificate heading'},
{key:'region_line',label:'Region / origin line',hint:'Jimma Zone · Oromia · Ethiopia'},
{key:'disclaimer',label:'Legal disclaimer',hint:'Keep AI-assessment limitations explicit',multiline:true},
{key:'footer_note',label:'Verification footer',hint:'QR verification instruction',multiline:true},
{key:'accent_color',label:'Accent color (hex)',hint:'#7F1D1D'},
{key:'border_color',label:'Border color (hex)',hint:'#2C1810'}];
function Action({label,onPress,secondary=false,disabled=false}:{label:string;onPress:()=>void;secondary?:boolean;disabled?:boolean}){
return <Pressable onPress={onPress} disabled={disabled} style={{backgroundColor:secondary?'#EFF3ED':'#26372D',paddingHorizontal:12,paddingVertical:10,borderRadius:9,opacity:disabled?0.45:1}}><Text style={{color:secondary?green:'#FFFFFF',fontSize:10,fontWeight:'900'}}>{label}</Text></Pressable>;
}
function Field({label,value,onChangeText,hint,multiline}:{label:string;value:string;onChangeText:(v:string)=>void;hint:string;multiline?:boolean}){
return <View style={{gap:5}}><Text style={{color:ink,fontSize:10,fontWeight:'900'}}>{label}</Text><TextInput value={value} onChangeText={onChangeText} placeholder={hint} placeholderTextColor="#9AA298" multiline={multiline} style={{borderWidth:1,borderColor:'#DDE4DA',borderRadius:9,padding:10,color:ink,fontSize:11,minHeight:multiline?66:40,textAlignVertical:multiline?'top':'center'}}/></View>;
}
export default function CertificateTemplateManagement(){
const [rows,setRows]=useState<Row[]>([]),[draftId,setDraftId]=useState<string|null>(null),[draft,setDraft]=useState<CertificateTemplate>(DEFAULT_CERTIFICATE_TEMPLATE);
const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
const load=useCallback(async()=>{if(!supabase){setError('Supabase is not configured.');setLoading(false);return;}setLoading(true);setError('');
const {data,error}=await supabase.from('certificate_templates').select('*').order('version',{ascending:false});
if(error)setError(error.message);else setRows((data||[]) as Row[]);setLoading(false);},[]);
useEffect(()=>{void load();},[load]);
const active=rows.find(r=>r.status==='active')||null;
const setField=(key:keyof CertificateTemplate,value:string)=>setDraft(v=>({...v,[key]:value}));
const createDraft=async()=>{if(!supabase||saving||draftId)return;setSaving(true);setError('');setNotice('');
try{const version=Math.max(0,...rows.map(r=>r.version))+1;const {data:user}=await supabase.auth.getUser();const src=active||DEFAULT_CERTIFICATE_TEMPLATE;
const {data,error}=await supabase.from('certificate_templates').insert({version,name:'Certificate template v'+version,organization_name:src.organization_name,certificate_title:src.certificate_title,region_line:src.region_line,disclaimer:src.disclaimer,footer_note:src.footer_note,accent_color:src.accent_color,border_color:src.border_color,status:'draft',created_by:user.user?.id||null}).select('*').single();
if(error)throw error;const row=data as Row;setRows(v=>[row,...v]);setDraftId(row.id);setDraft(row);setNotice('Draft version '+version+' created. Active template unchanged.');
}catch(e){setError(e instanceof Error?e.message:'Could not create a template draft.');}finally{setSaving(false);}};
const edit=(row:Row)=>{setDraftId(row.id);setDraft({...row});setNotice('Editing draft version '+row.version+'.');};
const save=async():Promise<boolean>=>{if(!supabase||!draftId||saving)return false;
if(draft.name.trim().length<2||!draft.organization_name.trim()||!draft.certificate_title.trim()||!draft.disclaimer.trim()){setError('Template name, issuer, title and disclaimer are required.');return false;}
if(!/^#[0-9A-Fa-f]{6}$/.test(draft.accent_color)||!/^#[0-9A-Fa-f]{6}$/.test(draft.border_color)){setError('Colors must use six-digit hex values, e.g. #7F1D1D.');return false;}
setSaving(true);setError('');setNotice('');
try{const {error}=await supabase.from('certificate_templates').update({name:draft.name.trim(),organization_name:draft.organization_name.trim(),certificate_title:draft.certificate_title.trim(),region_line:draft.region_line.trim(),disclaimer:draft.disclaimer.trim(),footer_note:draft.footer_note.trim(),accent_color:draft.accent_color.toUpperCase(),border_color:draft.border_color.toUpperCase()}).eq('id',draftId).eq('status','draft');
if(error)throw error;await load();setNotice('Draft saved. It is not live until activated.');return true;
}catch(e){setError(e instanceof Error?e.message:'Template could not be saved.');return false;}finally{setSaving(false);}};
const activate=async()=>{if(!supabase||!draftId||saving)return;if(!await save())return;setSaving(true);setError('');setNotice('');
try{const {error}=await supabase.rpc('activate_certificate_template',{p_template_id:draftId});if(error)throw error;const version=draft.version;setDraftId(null);await load();setNotice('Certificate template v'+version+' is now active for signed-in app users.');}
catch(e){setError(e instanceof Error?e.message:'Template could not be activated.');}finally{setSaving(false);}};
return <View style={{gap:13}}>
<View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:10}}><View style={{flex:1}}><Text style={{color:ink,fontSize:18,fontWeight:'900'}}>Certificate Templates</Text><Text style={{color:muted,fontSize:10,marginTop:4}}>Manage certificate identity, disclaimer, verification copy and visual colors.</Text></View><Pressable onPress={()=>void load()} style={{padding:9,borderWidth:1,borderColor:'#DDE4DA',borderRadius:9,flexDirection:'row',gap:6,alignItems:'center'}}><RefreshCw size={13} color={green}/><Text style={{color:green,fontSize:9,fontWeight:'900'}}>Refresh</Text></Pressable></View>
<View style={{...panel,padding:14,gap:7}}><View style={{flexDirection:'row',alignItems:'center',gap:7}}><ShieldCheck size={16} color={green}/><Text style={{color:ink,fontSize:12,fontWeight:'900'}}>Issuance and verification boundary</Text></View><Text style={{color:muted,fontSize:10,lineHeight:16}}>BunaLens certificates are AI-assisted visual assessment records, not official ECX or laboratory certificates. A certificate is generated from a saved batch and its verification ID; this module manages the shared display template, not batch approval or certificate revocation.</Text><Text style={{color:muted,fontSize:9}}>Only the active template is readable by signed-in app users. Public QR verification returns assessment facts, not private template settings.</Text></View>
{error?<View style={{...panel,padding:11,backgroundColor:'#FBF0ED',borderColor:'#E7BDB3',flexDirection:'row',gap:7}}><AlertCircle size={14} color="#A34F3E"/><Text style={{color:'#7D3C32',fontSize:10,flex:1}}>{error}</Text></View>:null}
{notice?<View style={{...panel,padding:11,backgroundColor:'#F0F5EE',borderColor:'#D6E2D2',flexDirection:'row',gap:7}}><CheckCircle2 size={14} color={green}/><Text style={{color:green,fontSize:10,flex:1}}>{notice}</Text></View>:null}
<View style={{...panel,padding:14,gap:10}}><View style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8}}><View style={{flex:1}}><Text style={{color:ink,fontSize:13,fontWeight:'900'}}>Template version history</Text><Text style={{color:muted,fontSize:9,marginTop:3}}>Active versions are immutable. Create a new draft to make changes.</Text></View><Action label="New template" onPress={()=>void createDraft()} disabled={saving||!!draftId}/></View>
{loading?<ActivityIndicator color={green}/>:rows.map(row=><View key={row.id} style={{borderTopWidth:1,borderColor:'#EEF0EC',paddingVertical:10,gap:5}}><View style={{flexDirection:'row',alignItems:'center',gap:8}}><Text style={{color:ink,fontSize:11,fontWeight:'900',flex:1}}>v{row.version} · {row.name}</Text><Text style={{color:row.status==='active'?green:muted,fontSize:9,fontWeight:'900',textTransform:'uppercase'}}>{row.status}</Text></View><Text style={{color:muted,fontSize:9}}>{row.organization_name} · {row.certificate_title}</Text><Text style={{color:muted,fontSize:9}}>Created {new Date(row.created_at||'').toLocaleString()}{row.activated_at?' · Activated '+new Date(row.activated_at).toLocaleString():''}</Text><View style={{flexDirection:'row',alignItems:'center',gap:6}}><View style={{width:16,height:16,borderRadius:4,backgroundColor:row.accent_color}}/><View style={{width:16,height:16,borderRadius:4,backgroundColor:row.border_color}}/><Text style={{color:muted,fontSize:9}}>Accent / border</Text></View>{row.status==='draft'?<View style={{alignSelf:'flex-start'}}><Action label={draftId===row.id?'Editing':'Edit draft'} secondary onPress={()=>edit(row)}/></View>:null}</View>)}
{!rows.length&&!loading?<Text style={{color:muted,fontSize:10}}>No certificate templates found.</Text>:null}</View>
{draftId?<View style={{...panel,padding:14,gap:10}}><Text style={{color:ink,fontSize:13,fontWeight:'900'}}>Edit draft · v{draft.version}</Text>
{fields.map(field=><Field key={field.key} label={field.label} hint={field.hint} multiline={field.multiline} value={String(draft[field.key]||'')} onChangeText={v=>setField(field.key,v)}/>)}
<View style={{borderWidth:1,borderColor:'#E5E9E0',borderRadius:12,padding:12,gap:6}}><Text style={{color:muted,fontSize:9,fontWeight:'900'}}>TEXT PREVIEW</Text><Text style={{color:draft.accent_color,fontSize:15,fontWeight:'900'}}>{draft.organization_name||'Issuer'}</Text><Text style={{color:ink,fontSize:11,fontWeight:'900'}}>{draft.certificate_title||'Certificate title'}</Text><Text style={{color:muted,fontSize:9}}>{draft.region_line}</Text><Text style={{color:muted,fontSize:9,lineHeight:14}}>{draft.disclaimer}</Text><Text style={{color:muted,fontSize:9}}>{draft.footer_note}</Text></View>
<View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}><Action label={saving?'Saving…':'Save draft'} onPress={()=>void save()} disabled={saving}/><Action label={saving?'Working…':'Activate template'} onPress={()=>void activate()} disabled={saving}/><Action label="Close editor" secondary onPress={()=>setDraftId(null)}/></View></View>:null}
</View>;
}
