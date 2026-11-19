import { supabase } from '@/services/supabaseClient';

export type CertificateTemplate = {
 id?: string; version?: number; name: string; organization_name: string; certificate_title: string;
 region_line: string; disclaimer: string; footer_note: string; accent_color: string; border_color: string;
 status?: 'draft'|'active'|'archived'; created_at?: string; activated_at?: string|null;
};
export const DEFAULT_CERTIFICATE_TEMPLATE: CertificateTemplate = {
 name:'BunaLens default certificate',organization_name:'BunaLens',
 certificate_title:'BUNALENS DIGITAL COFFEE QUALITY CERTIFICATE',
 region_line:'JIMMA ZONE · OROMIA · ETHIOPIA',
 disclaimer:'AI-assisted visual assessment only. Not an official Ethiopian Commodity Exchange certificate or laboratory quality report.',
 footer_note:'Verify this record using the QR code or verification ID.',
 accent_color:'#7F1D1D',border_color:'#2C1810',status:'active'
};
export async function getActiveCertificateTemplate():Promise<CertificateTemplate>{
 if(!supabase)return DEFAULT_CERTIFICATE_TEMPLATE;
 const {data,error}=await supabase.from('certificate_templates')
  .select('id,version,name,organization_name,certificate_title,region_line,disclaimer,footer_note,accent_color,border_color,status,created_at,activated_at')
  .eq('status','active').maybeSingle();
 return error||!data?DEFAULT_CERTIFICATE_TEMPLATE:data as CertificateTemplate;
}
