export interface SkinProfile {
  id: string
  user_id: string
  skin_type: 'oily' | 'dry' | 'combination' | 'normal' | 'sensitive'
  skin_concerns: string[]
  allergies: string[]
  fitzpatrick_scale: 1 | 2 | 3 | 4 | 5 | 6
  climate: 'humid' | 'dry' | 'temperate' | 'tropical' | 'cold'
  age_range: '13-17' | '18-24' | '25-30' | '31-40' | '41-50' | '51+'
  budget_range: 'budget' | 'mid' | 'premium' | 'luxury'
  experience_level: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  created_at: string
  updated_at: string
}

export type PaRating = 'PA+' | 'PA++' | 'PA+++' | 'PA++++'
export type SunscreenType = 'chemical' | 'physical' | 'hybrid'
export type WhiteCast = 'none' | 'minimal' | 'moderate' | 'heavy'
export type SunscreenFinish = 'matte' | 'dewy' | 'natural' | 'satin'
export type SunscreenActivity = 'daily' | 'outdoor' | 'water_sports'

export interface Product {
  id: string
  name_en: string
  name_ko: string
  brand_en: string
  brand_ko: string
  category: ProductCategory
  subcategory: string
  description_en: string
  description_ko: string | null
  image_url: string | null
  volume_ml: number | null
  volume_display: string | null
  price_krw: number | null
  price_usd: number | null
  rating_avg: number | null
  review_count: number
  is_verified: boolean
  created_at: string
  updated_at: string
  // Sunscreen-specific fields
  spf_rating: number | null
  pa_rating: PaRating | null
  sunscreen_type: SunscreenType | null
  white_cast: WhiteCast | null
  finish: SunscreenFinish | null
  under_makeup: boolean | null
  water_resistant: boolean | null
  suitable_for_activity: SunscreenActivity | null
  // Reformulation tracking fields
  current_formulation_version: number
  last_reformulated_at: string | null
}

export type ProductCategory =
  | 'cleanser'
  | 'toner'
  | 'essence'
  | 'serum'
  | 'ampoule'
  | 'moisturizer'
  | 'sunscreen'
  | 'mask'
  | 'eye_care'
  | 'lip_care'
  | 'exfoliator'
  | 'oil'
  | 'mist'
  | 'spot_treatment'

export interface Ingredient {
  id: string
  name_inci: string
  name_en: string
  name_ko: string | null
  function: string
  description: string
  safety_rating: number
  comedogenic_rating: number
  is_fragrance: boolean
  is_active: boolean
  common_concerns: string[]
  created_at: string
}

export interface ProductIngredient {
  id: string
  product_id: string
  ingredient_id: string
  position: number
  concentration_pct: number | null
}

export interface IngredientConflict {
  id: string
  ingredient_a_id: string
  ingredient_b_id: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  recommendation: string
}

export interface ProductPrice {
  id: string
  product_id: string
  retailer_id: string
  price_usd: number
  price_krw: number | null
  url: string
  in_stock: boolean
  last_checked: string
  created_at: string
}

export interface Retailer {
  id: string
  name: string
  website: string
  country: string
  trust_score: number
  ships_international: boolean
  affiliate_program: boolean
  affiliate_url_template: string | null
}

export interface UserRoutine {
  id: string
  user_id: string
  name: string
  routine_type: 'am' | 'pm' | 'weekly'
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface RoutineProduct {
  id: string
  routine_id: string
  product_id: string
  step_order: number
  frequency: 'daily' | 'every_other_day' | 'twice_week' | 'weekly'
  notes: string | null
  product?: Product
}

export interface UserScan {
  id: string
  user_id: string
  product_id: string | null
  image_url: string
  scan_type: 'label' | 'barcode' | 'product'
  extracted_text: string | null
  ingredients_found: string[]
  analysis_result: Record<string, unknown> | null
  created_at: string
}

export interface Review {
  id: string
  user_id: string
  product_id: string
  rating: number
  title: string
  body: string
  skin_type: string | null
  skin_concerns: string[]
  reaction: 'holy_grail' | 'good' | 'okay' | 'bad' | 'broke_me_out' | null
  would_repurchase: boolean | null
  usage_duration: string | null
  fitzpatrick_scale: number | null
  age_range: string | null
  helpful_count: number
  created_at: string
  updated_at: string
}

export interface YuriConversation {
  id: string
  user_id: string
  title: string | null
  specialist_type: SpecialistType | null
  message_count: number
  created_at: string
  updated_at: string
}

export type SpecialistType =
  | 'ingredient_analyst'
  | 'routine_architect'
  | 'authenticity_investigator'
  | 'trend_scout'
  | 'budget_optimizer'
  | 'sensitivity_guardian'

export interface YuriMessage {
  id: string
  conversation_id: string
  role: 'user' | 'assistant'
  content: string
  image_urls: string[]
  specialist_type: SpecialistType | null
  created_at: string
}

export interface TrendingProduct {
  id: string
  product_id: string
  source: 'tiktok' | 'reddit' | 'instagram' | 'korean_market'
  trend_score: number
  mention_count: number
  sentiment_score: number | null
  trending_since: string
  created_at: string
  product?: Product
}

export type SubscriptionPlan = 'pro_monthly'
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing'

export interface Subscription {
  id: string
  user_id: string
  stripe_customer_id: string
  stripe_subscription_id: string
  plan: SubscriptionPlan
  status: SubscriptionStatus
  current_period_start: string
  current_period_end: string
  canceled_at: string | null
  created_at: string
  updated_at: string
}

export interface SubscriptionEvent {
  id: string
  subscription_id: string | null
  event_type: string
  stripe_event_id: string
  event_data: Record<string, unknown>
  created_at: string
}

export interface AffiliateClick {
  id: string
  user_id: string | null
  product_id: string | null
  retailer_id: string | null
  affiliate_url: string
  clicked_at: string
}

export interface ReviewWithProfile extends Review {
  user_profile?: {
    skin_type: string | null
    age_range: string | null
    experience_level: string | null
  }
  product?: {
    id: string
    name_en: string
    brand_en: string
    image_url: string | null
    category: string
  }
}

export interface CommunityPoints {
  id: string
  user_id: string
  action: string
  points: number
  reference_id: string | null
  created_at: string
}

export interface UserPointsSummary {
  total_points: number
  reviews_written: number
  holy_grails_shared: number
  broke_me_out_shared: number
  level: string
  next_level_points: number
}

export interface TrendingProductWithDetails extends TrendingProduct {
  product: Product
}

export interface LearningPattern {
  id: string
  pattern_type:
    | 'ingredient_effectiveness'
    | 'routine_success'
    | 'skin_type_correlation'
    | 'price_trend'
    | 'counterfeit_signal'
    | 'product_match'
    | 'routine_adjustment'
    | 'seasonal'
  skin_type: string | null
  skin_concerns: string[]
  concern_filter: string | null
  pattern_description: string | null
  data: Record<string, unknown>
  confidence_score: number
  sample_size: number
  created_at: string
  updated_at: string
}

export interface IngredientEffectiveness {
  id: string
  ingredient_id: string
  skin_type: string | null
  concern: string | null
  effectiveness_score: number
  sample_size: number
  positive_reports: number
  negative_reports: number
  neutral_reports: number
  updated_at: string
  ingredient?: Ingredient
}

export interface RoutineOutcome {
  id: string
  user_id: string
  routine: Record<string, unknown>
  skin_type: string | null
  concerns: string[]
  started_at: string
  outcome_reported_at: string | null
  outcome_score: number | null
  outcome_notes: string | null
  before_photo_url: string | null
  after_photo_url: string | null
  created_at: string
}

export interface PriceHistory {
  id: string
  product_id: string
  retailer: string
  price: number
  currency: string
  recorded_at: string
}

export type TrendStatus = 'emerging' | 'trending' | 'peaked' | 'declining'
export type TrendType = 'ingredient' | 'product_category' | 'routine_step' | 'brand'

export interface TrendSignal {
  id: string
  source: string
  keyword: string
  signal_strength: number
  trend_name: string | null
  trend_type: TrendType | null
  first_detected_at: string
  peak_at: string | null
  status: TrendStatus
  data: Record<string, unknown> | null
  detected_at: string
}

export interface LearningInsight {
  title: string
  description: string
  confidence: number
  sample_size: number
  type: 'ingredient' | 'routine' | 'trend' | 'price'
}

export interface PersonalizedRecommendation {
  product_id: string
  product_name: string
  brand: string
  category: string
  match_score: number
  reasons: string[]
  effectiveness_data: {
    score: number
    sample_size: number
  } | null
  product?: Product
}

// =============================================================================
// Phase 5: Counterfeit Detection & Safety
// =============================================================================

export type AlertType = 'counterfeit_wave' | 'recall' | 'ingredient_warning' | 'seller_warning' | 'batch_issue'
export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'
export type CounterfeitRecommendation = 'likely_authentic' | 'suspicious' | 'likely_counterfeit' | 'inconclusive'

export interface CounterfeitMarker {
  id: string
  brand: string
  marker_type: string
  description: string
  image_url: string | null
  severity: 'low' | 'medium' | 'high' | 'critical'
  created_at: string
}

export interface CounterfeitReport {
  id: string
  user_id: string
  product_id: string | null
  description: string
  image_urls: string[]
  status: 'pending' | 'reviewing' | 'confirmed' | 'rejected'
  seller_name: string | null
  purchase_platform: string | null
  purchase_url: string | null
  brand: string | null
  batch_code: string | null
  verified_counterfeit: boolean | null
  created_at: string
  updated_at: string
  product?: Product
}

export interface CounterfeitScan {
  id: string
  user_id: string
  product_id: string | null
  image_urls: string[]
  brand_detected: string | null
  product_detected: string | null
  authenticity_score: number | null
  red_flags: CounterfeitFlag[]
  green_flags: CounterfeitFlag[]
  analysis_summary: string | null
  recommendation: CounterfeitRecommendation | null
  markers_matched: string[]
  created_at: string
  product?: Product
}

export interface CounterfeitFlag {
  flag: string
  severity?: 'low' | 'medium' | 'high' | 'critical'
  description: string
}

export interface BatchCodeVerification {
  id: string
  user_id: string
  product_id: string | null
  brand: string
  batch_code: string
  decoded_info: BatchCodeInfo | null
  is_valid: boolean | null
  confidence: number | null
  notes: string | null
  created_at: string
}

export interface BatchCodeInfo {
  manufacture_date: string | null
  expiry_date: string | null
  factory_location: string | null
  product_line: string | null
  is_expired: boolean
  age_months: number | null
}

export interface SafetyAlert {
  id: string
  alert_type: AlertType
  severity: AlertSeverity
  title: string
  description: string
  affected_brands: string[]
  affected_products: string[]
  affected_retailers: string[]
  source: string | null
  is_active: boolean
  created_at: string
  expires_at: string | null
}

export interface RetailerWithVerification extends Retailer {
  is_authorized: boolean
  authorized_brands: string[]
  risk_level: 'low' | 'medium' | 'high' | 'very_high' | null
  verification_notes: string | null
  counterfeit_report_count: number
  last_verified_at: string | null
}

// =============================================================================
// Phase 3B: Yuri Conversational Onboarding
// =============================================================================

export type OnboardingStatus = 'in_progress' | 'completed' | 'skipped'
export type ConversationType = 'general' | 'onboarding' | 'specialist'

export interface OnboardingProgress {
  id: string
  user_id: string
  conversation_id: string | null
  onboarding_status: OnboardingStatus
  skin_profile_data: ExtractedSkinProfile
  extracted_fields: Record<string, boolean>
  required_fields: string[]
  completion_percentage: number
  started_at: string
  completed_at: string | null
  created_at: string
  updated_at: string
}

// =============================================================================
// Feature 8.5: Expiration / PAO Tracking
// =============================================================================

export type TrackingStatus = 'active' | 'expired' | 'finished' | 'discarded'

export interface UserProductTracking {
  id: string
  user_id: string
  product_id: string | null
  custom_product_name: string | null
  opened_date: string
  expiry_date: string | null
  pao_months: number | null
  purchase_date: string | null
  manufacture_date: string | null
  batch_code: string | null
  notes: string | null
  status: TrackingStatus
  created_at: string
  updated_at: string
  product?: Product
}

// =============================================================================
// Feature 8.6: Reformulation Tracker
// =============================================================================

export type ReformulationChangeType = 'reformulation' | 'packaging' | 'both' | 'minor_tweak'
export type ReformulationDetectedBy = 'manual' | 'scan_comparison' | 'cron_job'

export interface FormulationHistory {
  id: string
  product_id: string
  version_number: number
  change_date: string | null
  change_type: ReformulationChangeType | null
  ingredients_added: string[]
  ingredients_removed: string[]
  ingredients_reordered: boolean
  change_summary: string | null
  impact_assessment: string | null
  detected_by: ReformulationDetectedBy
  confirmed: boolean
  created_at: string
  updated_at: string
  product?: Product
}

export interface ReformulationAlert {
  id: string
  user_id: string
  product_id: string
  formulation_history_id: string
  seen: boolean
  dismissed: boolean
  created_at: string
  product?: Product
  formulation_history?: FormulationHistory
}

export interface ReformulationDetectionResult {
  changed: boolean
  added: string[]
  removed: string[]
  reordered: boolean
  history?: FormulationHistory
  alerts_created: number
}

export interface ExtractedSkinProfile {
  skin_type?: 'oily' | 'dry' | 'combination' | 'normal' | 'sensitive'
  skin_concerns?: string[]
  age_range?: '13-17' | '18-24' | '25-30' | '31-40' | '41-50' | '51+'
  fitzpatrick_scale?: 1 | 2 | 3 | 4 | 5 | 6
  climate?: 'humid' | 'dry' | 'temperate' | 'tropical' | 'cold'
  allergies?: string[]
  current_routine?: string[]
  budget_preference?: 'budget' | 'mid' | 'premium' | 'luxury'
  experience_level?: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  product_preferences?: string[]
}

// =============================================================================
// Feature 8.8: Hormonal Cycle Routine Adjustments
// =============================================================================

export type CyclePhase = 'menstrual' | 'follicular' | 'ovulatory' | 'luteal'

export interface UserCycleTracking {
  id: string
  user_id: string
  cycle_start_date: string
  cycle_length_days: number
  notes: string | null
  created_at: string
  updated_at: string
}

export interface CyclePhaseInfo {
  phase: CyclePhase
  day_in_cycle: number
  days_until_next_phase: number
  cycle_length: number
  skin_behavior: string
  recommendations: string[]
}

export interface CycleRoutineAdjustment {
  type: 'add' | 'reduce' | 'swap' | 'avoid' | 'emphasize'
  product_category: string
  reason: string
  suggestion: string
}

// =============================================================================
// Feature 8.9: Glass Skin Score — Photo Tracking
// =============================================================================

export type GlassSkinDimension = 'luminosity' | 'smoothness' | 'clarity' | 'hydration' | 'evenness'

export interface GlassSkinScore {
  id: string
  user_id: string
  overall_score: number
  luminosity_score: number
  smoothness_score: number
  clarity_score: number
  hydration_score: number
  evenness_score: number
  recommendations: string[]
  analysis_notes: string | null
  created_at: string
  updated_at: string
}

export interface GlassSkinDimensionScore {
  dimension: GlassSkinDimension
  score: number
  label: string
  description: string
}

export interface GlassSkinAnalysisResult {
  overall_score: number
  luminosity_score: number
  smoothness_score: number
  clarity_score: number
  hydration_score: number
  evenness_score: number
  recommendations: string[]
  analysis_notes: string
}

export interface GlassSkinComparison {
  current: GlassSkinScore
  previous: GlassSkinScore | null
  score_change: number
  improved_dimensions: GlassSkinDimension[]
  declined_dimensions: GlassSkinDimension[]
}
