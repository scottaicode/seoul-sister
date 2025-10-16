import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ConversationThread {
  id: string;
  platform: string;
  original_post: any;
  ai_responses: any[];
  user_responses: any[];
  qualification_data: QualificationData;
  lead_potential: 'low' | 'medium' | 'high' | 'premium';
  handoff_ready: boolean;
}

interface QualificationData {
  authenticity_interest: number; // 0-1 scale
  price_sensitivity: number; // 0-1 scale
  cultural_interest: number; // 0-1 scale
  product_sophistication: number; // 0-1 scale
  purchase_intent: number; // 0-1 scale
  seoul_sister_fit: number; // 0-1 scale
  engagement_quality: number; // 0-1 scale
  response_indicators: {
    asks_follow_up_questions: boolean;
    shares_personal_experience: boolean;
    shows_price_awareness: boolean;
    expresses_authenticity_concerns: boolean;
    interested_in_cultural_context: boolean;
    mentions_current_routine: boolean;
    indicates_budget_range: boolean;
  };
  conversation_signals: {
    total_responses: number;
    avg_response_length: number;
    uses_korean_terms: boolean;
    asks_about_seoul_sister: boolean;
    requests_more_information: boolean;
    shows_skepticism: boolean;
    demonstrates_expertise: boolean;
  };
  lead_scoring: {
    demographic_fit: number;
    interest_alignment: number;
    engagement_quality: number;
    conversion_probability: number;
    lifetime_value_potential: number;
  };
}

interface QualificationResult {
  qualified: boolean;
  lead_quality: 'low' | 'medium' | 'high' | 'premium';
  qualification_score: number;
  handoff_recommendation: 'immediate' | 'nurture' | 'disqualify';
  lead_profile: LeadProfile;
  next_actions: string[];
  confidence_level: number;
}

interface LeadProfile {
  persona: 'budget_conscious' | 'authenticity_seeker' | 'cultural_enthusiast' | 'premium_buyer' | 'skeptical_researcher';
  primary_motivation: string;
  pain_points: string[];
  seoul_sister_value_props: string[];
  recommended_approach: string;
  estimated_conversion_probability: number;
  potential_lifetime_value: number;
}

export class ConversationQualifier {
  private readonly QUALIFICATION_THRESHOLDS = {
    minimum_qualification_score: 0.6,
    high_quality_threshold: 0.8,
    premium_threshold: 0.9,
    handoff_readiness_score: 0.75
  };

  private readonly SEOUL_SISTER_VALUE_MATRIX = {
    authenticity_concerns: {
      value_props: ['Verified Seoul suppliers', 'Authenticity guarantee', 'Korean community verification'],
      messaging: 'Seoul Sister eliminates authenticity concerns through verified Seoul supplier network'
    },
    price_sensitivity: {
      value_props: ['Seoul wholesale pricing', '60-70% savings vs US retail', 'No distributor markup'],
      messaging: 'Seoul Sister provides Seoul wholesale access at authentic prices'
    },
    cultural_interest: {
      value_props: ['Korean beauty cultural education', 'Traditional technique guidance', 'Pronunciation guides'],
      messaging: 'Seoul Sister offers authentic Korean beauty cultural intelligence and education'
    },
    product_expertise: {
      value_props: ['Expert product curation', 'Ingredient analysis', 'Routine customization'],
      messaging: 'Seoul Sister provides expert-level Korean beauty product intelligence and guidance'
    }
  };

  async qualifyConversation(thread: ConversationThread): Promise<QualificationResult> {
    try {
      console.log(`🎯 Qualifying conversation thread: ${thread.id}`);

      // Analyze conversation content for qualification signals
      const qualificationData = await this.analyzeConversationContent(thread);

      // Calculate qualification scores
      const scores = this.calculateQualificationScores(qualificationData);

      // Determine lead quality and handoff readiness
      const leadQuality = this.determineLeadQuality(scores.overall_score);
      const handoffRecommendation = this.determineHandoffRecommendation(scores, qualificationData);

      // Generate lead profile
      const leadProfile = this.generateLeadProfile(qualificationData, scores);

      // Calculate confidence level
      const confidenceLevel = this.calculateConfidenceLevel(thread, qualificationData);

      const result: QualificationResult = {
        qualified: scores.overall_score >= this.QUALIFICATION_THRESHOLDS.minimum_qualification_score,
        lead_quality: leadQuality,
        qualification_score: scores.overall_score,
        handoff_recommendation: handoffRecommendation,
        lead_profile: leadProfile,
        next_actions: this.generateNextActions(leadQuality, handoffRecommendation, leadProfile),
        confidence_level: confidenceLevel
      };

      // Store qualification result
      await this.storeQualificationResult(thread.id, result);

      return result;

    } catch (error) {
      console.error('❌ Error qualifying conversation:', error);
      throw error;
    }
  }

  private async analyzeConversationContent(thread: ConversationThread): Promise<QualificationData> {
    const userResponses = thread.user_responses;
    const combinedUserText = userResponses.map(r => r.content).join(' ').toLowerCase();

    // Analyze response indicators
    const responseIndicators = {
      asks_follow_up_questions: /\?/.test(combinedUserText) && userResponses.length > 1,
      shares_personal_experience: /(i've|i have|my skin|my routine|i tried|i use)/.test(combinedUserText),
      shows_price_awareness: /(expensive|cost|budget|price|affordable|cheap)/.test(combinedUserText),
      expresses_authenticity_concerns: /(fake|real|authentic|counterfeit|genuine)/.test(combinedUserText),
      interested_in_cultural_context: /(culture|traditional|korean way|philosophy|seoul|korea)/.test(combinedUserText),
      mentions_current_routine: /(routine|steps|currently use|my regimen)/.test(combinedUserText),
      indicates_budget_range: /(\$|dollars|budget is|spend|worth)/.test(combinedUserText)
    };

    // Analyze conversation signals
    const conversationSignals = {
      total_responses: userResponses.length,
      avg_response_length: userResponses.reduce((sum, r) => sum + r.content.length, 0) / userResponses.length,
      uses_korean_terms: /(chok-chok|mul-gwang|glass skin|7-skin|hanbang)/.test(combinedUserText),
      asks_about_seoul_sister: /seoul sister/.test(combinedUserText),
      requests_more_information: /(tell me more|learn more|where can|how do i)/.test(combinedUserText),
      shows_skepticism: /(skeptical|doubt|suspicious|not sure|unsure)/.test(combinedUserText),
      demonstrates_expertise: /(cosrx|laneige|innisfree|beauty of joseon|purito)/.test(combinedUserText)
    };

    // Calculate individual qualification scores
    const authenticity_interest = this.calculateAuthenticityInterest(responseIndicators, combinedUserText);
    const price_sensitivity = this.calculatePriceSensitivity(responseIndicators, combinedUserText);
    const cultural_interest = this.calculateCulturalInterest(responseIndicators, conversationSignals);
    const product_sophistication = this.calculateProductSophistication(conversationSignals, combinedUserText);
    const purchase_intent = this.calculatePurchaseIntent(responseIndicators, conversationSignals);
    const seoul_sister_fit = this.calculateSeoulSisterFit(authenticity_interest, price_sensitivity, cultural_interest);
    const engagement_quality = this.calculateEngagementQuality(conversationSignals, responseIndicators);

    return {
      authenticity_interest,
      price_sensitivity,
      cultural_interest,
      product_sophistication,
      purchase_intent,
      seoul_sister_fit,
      engagement_quality,
      response_indicators,
      conversation_signals,
      lead_scoring: {
        demographic_fit: this.calculateDemographicFit(responseIndicators, conversationSignals),
        interest_alignment: (authenticity_interest + cultural_interest) / 2,
        engagement_quality,
        conversion_probability: (purchase_intent + seoul_sister_fit + engagement_quality) / 3,
        lifetime_value_potential: this.calculateLifetimeValuePotential(product_sophistication, cultural_interest, price_sensitivity)
      }
    };
  }

  private calculateAuthenticityInterest(indicators: any, text: string): number {
    let score = 0;
    if (indicators.expresses_authenticity_concerns) score += 0.4;
    if (/(fake|counterfeit)/.test(text)) score += 0.3;
    if (/(verified|real|genuine|authentic)/.test(text)) score += 0.2;
    if (/(burned before|scammed|disappointed)/.test(text)) score += 0.1;
    return Math.min(score, 1.0);
  }

  private calculatePriceSensitivity(indicators: any, text: string): number {
    let score = 0;
    if (indicators.shows_price_awareness) score += 0.3;
    if (indicators.indicates_budget_range) score += 0.2;
    if (/(overpriced|expensive|markup|rip-?off)/.test(text)) score += 0.3;
    if (/(sephora|ulta).*(expensive|overpriced)/.test(text)) score += 0.2;
    return Math.min(score, 1.0);
  }

  private calculateCulturalInterest(indicators: any, signals: any): number {
    let score = 0;
    if (indicators.interested_in_cultural_context) score += 0.4;
    if (signals.uses_korean_terms) score += 0.3;
    if (indicators.asks_follow_up_questions) score += 0.2;
    if (signals.demonstrates_expertise) score += 0.1;
    return Math.min(score, 1.0);
  }

  private calculateProductSophistication(signals: any, text: string): number {
    let score = 0;
    if (signals.demonstrates_expertise) score += 0.4;
    if (indicators.mentions_current_routine) score += 0.2;
    if (/(ingredients|peptides|ceramides|niacinamide)/.test(text)) score += 0.2;
    if (signals.avg_response_length > 100) score += 0.2;
    return Math.min(score, 1.0);
  }

  private calculatePurchaseIntent(indicators: any, signals: any): number {
    let score = 0;
    if (indicators.indicates_budget_range) score += 0.3;
    if (signals.requests_more_information) score += 0.3;
    if (signals.asks_about_seoul_sister) score += 0.4;
    return Math.min(score, 1.0);
  }

  private calculateSeoulSisterFit(authenticity: number, price: number, cultural: number): number {
    // Seoul Sister value props align with these interests
    return (authenticity * 0.4 + price * 0.3 + cultural * 0.3);
  }

  private calculateEngagementQuality(signals: any, indicators: any): number {
    let score = 0;
    if (signals.total_responses >= 2) score += 0.2;
    if (signals.total_responses >= 4) score += 0.2;
    if (signals.avg_response_length > 50) score += 0.2;
    if (indicators.asks_follow_up_questions) score += 0.2;
    if (indicators.shares_personal_experience) score += 0.2;
    return Math.min(score, 1.0);
  }

  private calculateDemographicFit(indicators: any, signals: any): number {
    // Seoul Sister target: Korean beauty enthusiasts who value authenticity and cultural education
    let score = 0.5; // Base score
    if (indicators.interested_in_cultural_context) score += 0.2;
    if (indicators.expresses_authenticity_concerns) score += 0.2;
    if (signals.demonstrates_expertise) score += 0.1;
    return Math.min(score, 1.0);
  }

  private calculateLifetimeValuePotential(sophistication: number, cultural: number, price: number): number {
    // Higher sophistication + cultural interest + price awareness = higher LTV
    return (sophistication * 0.4 + cultural * 0.4 + (1 - price) * 0.2); // Note: lower price sensitivity = higher LTV potential
  }

  private calculateQualificationScores(data: QualificationData) {
    const weights = {
      authenticity_interest: 0.25,
      price_sensitivity: 0.15,
      cultural_interest: 0.20,
      purchase_intent: 0.25,
      engagement_quality: 0.15
    };

    const overall_score =
      data.authenticity_interest * weights.authenticity_interest +
      data.price_sensitivity * weights.price_sensitivity +
      data.cultural_interest * weights.cultural_interest +
      data.purchase_intent * weights.purchase_intent +
      data.engagement_quality * weights.engagement_quality;

    return {
      overall_score,
      category_scores: {
        authenticity: data.authenticity_interest,
        pricing: data.price_sensitivity,
        cultural: data.cultural_interest,
        intent: data.purchase_intent,
        engagement: data.engagement_quality
      }
    };
  }

  private determineLeadQuality(score: number): 'low' | 'medium' | 'high' | 'premium' {
    if (score >= this.QUALIFICATION_THRESHOLDS.premium_threshold) return 'premium';
    if (score >= this.QUALIFICATION_THRESHOLDS.high_quality_threshold) return 'high';
    if (score >= this.QUALIFICATION_THRESHOLDS.minimum_qualification_score) return 'medium';
    return 'low';
  }

  private determineHandoffRecommendation(scores: any, data: QualificationData): 'immediate' | 'nurture' | 'disqualify' {
    if (scores.overall_score >= this.QUALIFICATION_THRESHOLDS.handoff_readiness_score &&
        data.purchase_intent > 0.6) {
      return 'immediate';
    }
    if (scores.overall_score >= this.QUALIFICATION_THRESHOLDS.minimum_qualification_score) {
      return 'nurture';
    }
    return 'disqualify';
  }

  private generateLeadProfile(data: QualificationData, scores: any): LeadProfile {
    // Determine persona based on highest-scoring attributes
    let persona: LeadProfile['persona'] = 'skeptical_researcher';

    if (data.authenticity_interest > 0.7) persona = 'authenticity_seeker';
    else if (data.price_sensitivity > 0.7) persona = 'budget_conscious';
    else if (data.cultural_interest > 0.7) persona = 'cultural_enthusiast';
    else if (data.product_sophistication > 0.7 && data.price_sensitivity < 0.4) persona = 'premium_buyer';

    const personaProfiles = {
      authenticity_seeker: {
        motivation: 'Seeks genuine Korean beauty products without counterfeits',
        pain_points: ['Fake product concerns', 'Verification difficulties', 'Trust issues with sellers'],
        value_props: ['Verified Seoul suppliers', 'Authenticity guarantee', 'Community verification'],
        approach: 'Lead with authenticity credentials and verification methods'
      },
      budget_conscious: {
        motivation: 'Wants authentic Korean beauty at fair prices',
        pain_points: ['US retail markup', 'Expensive authentic options', 'Budget constraints'],
        value_props: ['Seoul wholesale pricing', '60-70% savings', 'No distributor markup'],
        approach: 'Focus on pricing intelligence and Seoul wholesale access'
      },
      cultural_enthusiast: {
        motivation: 'Deeply interested in Korean beauty culture and traditions',
        pain_points: ['Lack of cultural context', 'Surface-level product knowledge', 'Missing authenticity'],
        value_props: ['Cultural education', 'Traditional techniques', 'Korean community insights'],
        approach: 'Emphasize cultural intelligence and educational value'
      },
      premium_buyer: {
        motivation: 'Seeks high-quality Korean beauty with expert guidance',
        pain_points: ['Product selection overwhelm', 'Need for expertise', 'Quality assurance'],
        value_props: ['Expert curation', 'Premium product access', 'Personalized guidance'],
        approach: 'Position Seoul Sister as premium intelligence service'
      },
      skeptical_researcher: {
        motivation: 'Cautious about new services, needs proof of value',
        pain_points: ['Trust barriers', 'Information verification', 'Value demonstration'],
        value_props: ['Transparent intelligence', 'Proven track record', 'Educational approach'],
        approach: 'Provide evidence and build trust gradually'
      }
    };

    const profile = personaProfiles[persona];

    return {
      persona,
      primary_motivation: profile.motivation,
      pain_points: profile.pain_points,
      seoul_sister_value_props: profile.value_props,
      recommended_approach: profile.approach,
      estimated_conversion_probability: scores.overall_score,
      potential_lifetime_value: data.lead_scoring.lifetime_value_potential * 240 // $240 = 12 months * $20
    };
  }

  private generateNextActions(quality: string, handoff: string, profile: LeadProfile): string[] {
    const actions: string[] = [];

    if (handoff === 'immediate') {
      actions.push('Create warm lead handoff to Seoul Sister team');
      actions.push(`Use ${profile.persona} messaging approach`);
      actions.push(`Emphasize: ${profile.seoul_sister_value_props.join(', ')}`);
    } else if (handoff === 'nurture') {
      actions.push('Add to nurture sequence with cultural education content');
      actions.push('Track engagement with Korean beauty intelligence');
      actions.push('Re-qualify after 7 days of nurture interactions');
    } else {
      actions.push('Mark as unqualified lead');
      actions.push('Monitor for future engagement improvements');
    }

    if (quality === 'premium') {
      actions.push('Flag for priority handling');
      actions.push('Offer premium Seoul Sister insights preview');
    }

    return actions;
  }

  private calculateConfidenceLevel(thread: ConversationThread, data: QualificationData): number {
    let confidence = 0.5; // Base confidence

    // More responses = higher confidence
    if (data.conversation_signals.total_responses >= 3) confidence += 0.2;
    if (data.conversation_signals.total_responses >= 5) confidence += 0.1;

    // Quality responses = higher confidence
    if (data.conversation_signals.avg_response_length > 100) confidence += 0.1;
    if (data.response_indicators.shares_personal_experience) confidence += 0.1;

    return Math.min(confidence, 0.95);
  }

  private async storeQualificationResult(threadId: string, result: QualificationResult): Promise<void> {
    try {
      await supabase
        .from('ai_conversation_threads')
        .update({
          qualification_score: result.qualification_score,
          lead_potential: result.lead_quality,
          handoff_ready: result.handoff_recommendation === 'immediate',
          updated_at: new Date().toISOString()
        })
        .eq('id', threadId);

      // If qualified, create lead record
      if (result.qualified && result.handoff_recommendation === 'immediate') {
        await supabase
          .from('ai_generated_leads')
          .insert({
            source_platform: 'reddit',
            source_thread_id: threadId,
            lead_type: result.lead_profile.persona,
            intent_level: result.lead_quality,
            qualification_data: result.lead_profile,
            handoff_notes: `${result.lead_profile.recommended_approach}. Value props: ${result.lead_profile.seoul_sister_value_props.join(', ')}`,
            status: 'new',
            created_at: new Date().toISOString()
          });
      }
    } catch (error) {
      console.error('Error storing qualification result:', error);
    }
  }
}

export default ConversationQualifier;