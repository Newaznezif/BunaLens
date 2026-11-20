export type SampleType = 'red_cherry' | 'green_bean';
export type EcxGrade = 'Grade 1' | 'Grade 2' | 'Grade 3' | 'Grade 4' | 'Undergrade' | 'Unclassified';
export type ExportReadiness = 'Specialty Export' | 'Commercial Export' | 'Local Market Only' | 'Reject / Re-sort' | 'Insufficient Evidence';

export type UserProfileType = 'coffee_provider' | 'coffee_seller';
export type IdentityDocumentType = 'national_id' | 'passport' | 'kebele_id';
export type VerificationStatus = 'pending' | 'verified' | 'rejected';

export interface DocumentExtractedData {
  document_type: IdentityDocumentType;
  document_number: string;
  full_name: string;
  date_of_birth?: string;
  gender?: 'M' | 'F' | 'Other';
  nationality?: string;
  expiry_date?: string;
  issue_date?: string;
  issuing_authority?: string;
  address_or_woreda?: string;
  confidence_score: number;
  raw_text_summary?: string;
}

export interface BiometricData {
  facial_photo_uri?: string;
  facial_recognition_score?: number;
  facial_liveness_verified?: boolean;
  fingerprint_enrolled?: boolean;
  fingerprint_hash?: string;
  fingerprint_quality_score?: number;
  fingerprint_method?: 'hardware_sensor' | 'optical_scanner' | 'secure_passkey';
  captured_at: string;
}

export interface RegisteredUserIdentity {
  id: string;
  user_id?: string | null;
  profile_type: UserProfileType;
  full_name: string;
  phone: string;
  email?: string;
  woreda: string;
  kebele?: string;
  farm_or_business_name?: string;
  document_type: IdentityDocumentType;
  document_number: string;
  document_image_url?: string;
  document_extracted_data: DocumentExtractedData;
  biometric_data: BiometricData;
  verification_status: VerificationStatus;
  registered_by?: string;
  created_at: string;
  updated_at: string;
}

export interface GradingBreakdown {
  sound_or_ripe_pct: number;
  unripe_green_pct: number;
  black_overfermented_pct: number;
  insect_broken_pct: number;
  foreign_matter_pct: number;
}

export interface GradingResult {
  is_coffee_sample: boolean;
  rejection_reason?: string;
  ecx_grade: EcxGrade;
  quality_score: number;
  confidence_score: number;
  breakdown: GradingBreakdown;
  estimated_price_per_feresula_etb: number;
  potential_gain_if_sorted_etb: number;
  export_readiness: ExportReadiness;
  sorting_action_advice: string;
  assessment_limitations: string[];
  assessment_method: 'ai_visual_estimate';
  /** Backward-compatible fields for older locally saved records. */
  confidence?: number;
  assessment_note?: string;
}

export interface PricingAssessment {
  benchmark_id: string;
  source_label: string;
  effective_date: string;
  is_demo: boolean;
  min_etb_per_feresula: number;
  max_etb_per_feresula: number;
  estimated_price_per_feresula_etb: number;
  estimated_price_per_kg_etb: number;
  min_lot_value_etb: number;
  max_lot_value_etb: number;
  estimated_lot_value_etb: number;
  potential_sorting_gain_etb: number;
}

export interface CoffeeBatch {
  id: string;
  batch_code: string;
  sample_type: SampleType;
  woreda: string;
  created_at: string;
  image_uri?: string;
  origin_coordinates?: { latitude: number; longitude: number };
  result: GradingResult;
  lot_weight_kg: number;
  status: 'synced' | 'queued' | 'demo' | 'local' | 'processing' | 'failed';
  station_id: string;
  pricing?: PricingAssessment;
  verification_id?: string;
}

export interface Station {
  id: string;
  name: string;
  woreda: string;
  manager: string;
  credits: number;
  feresula_price_etb: number;
  pro_expires_at?: string;
  contact_phone?: string;
  contact_email?: string;
}
