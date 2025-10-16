import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CulturalResponse {
  id?: number;
  category: string;
  subcategory: string;
  trigger_keywords: string[];
  response_template: string;
  cultural_context: string;
  pronunciation_guide: string;
  traditional_wisdom: string;
  modern_application: string;
  seoul_sister_connection: string;
  engagement_effectiveness?: number;
  usage_count?: number;
}

interface ConversationContext {
  post_title: string;
  post_content: string;
  conversation_type: string;
  intent_score: number;
  keywords_matched: string[];
  user_tone: 'frustrated' | 'curious' | 'skeptical' | 'excited' | 'confused';
  authenticity_concern_level: 'low' | 'medium' | 'high';
  price_sensitivity: 'low' | 'medium' | 'high';
  cultural_interest: 'low' | 'medium' | 'high';
}

interface GeneratedResponse {
  primary_response: string;
  cultural_insight: string;
  pronunciation_note?: string;
  seoul_sister_mention: string;
  follow_up_hook: string;
  qualification_question: string;
  confidence_score: number;
  response_strategy: string;
}

export class KoreanCulturalResponseEngine {
  private readonly CULTURAL_KNOWLEDGE_BASE = {
    beauty_philosophy: {
      prevention_over_correction: {
        korean: '예방이 치료보다 낫다',
        romanized: 'ye-bang-i chi-ryo-bo-da nat-da',
        meaning: 'Prevention is better than treatment',
        application: 'Korean skincare focuses on preventing skin issues rather than correcting them after they occur'
      },
      gentle_consistency: {
        korean: '꾸준한 관리',
        romanized: 'kku-jun-han gwan-ri',
        meaning: 'Consistent care',
        application: 'Daily gentle routine is preferred over aggressive treatments'
      },
      natural_beauty: {
        korean: '자연스러운 아름다움',
        romanized: 'ja-yeon-seu-reo-un a-reum-da-um',
        meaning: 'Natural beauty',
        application: 'Enhancing natural features rather than dramatic transformation'
      }
    },
    beauty_terms: {
      glass_skin: {
        korean: '유리 피부',
        romanized: 'yu-ri pi-bu',
        cultural_meaning: 'Skin so clear and smooth it looks like glass',
        technique: '7-skin method with fermented essences for deep hydration'
      },
      water_light: {
        korean: '물광',
        romanized: 'mul-gwang',
        cultural_meaning: 'Water-light effect - dewy, luminous skin',
        technique: 'Layering hydrating products for natural glow'
      },
      honey_skin: {
        korean: '꿀 피부',
        romanized: 'kkul pi-bu',
        cultural_meaning: 'Smooth, sweet skin like honey',
        technique: 'Nourishing treatments with natural ingredients'
      }
    },
    traditional_ingredients: {
      ginseng: {
        korean: '인삼',
        romanized: 'in-sam',
        traditional_use: 'Energy and vitality enhancement for 2000+ years',
        modern_beauty: 'Anti-aging and circulation improvement in skincare'
      },
      rice_water: {
        korean: '쌀뜨물',
        romanized: 'ssal-tteu-mul',
        traditional_use: 'Geishas and Korean court ladies used for brightening',
        modern_beauty: 'Gentle exfoliation and skin brightening'
      },
      green_tea: {
        korean: '녹차',
        romanized: 'nok-cha',
        traditional_use: 'Anti-inflammatory properties in traditional medicine',
        modern_beauty: 'Antioxidant protection and soothing in skincare'
      }
    }
  };

  async generateCulturalResponse(context: ConversationContext): Promise<GeneratedResponse> {
    try {
      console.log('🇰🇷 Generating Korean cultural response for conversation...');

      // Analyze context to determine best cultural approach
      const responseStrategy = this.determineResponseStrategy(context);

      // Get relevant cultural knowledge
      const culturalKnowledge = await this.getCulturalKnowledge(context.keywords_matched);

      // Generate personalized response
      const response = await this.craftPersonalizedResponse(context, culturalKnowledge, responseStrategy);

      // Track usage for optimization
      await this.trackResponseUsage(culturalKnowledge.category, response.confidence_score);

      return response;

    } catch (error) {
      console.error('❌ Error generating cultural response:', error);
      throw error;
    }
  }

  private determineResponseStrategy(context: ConversationContext): string {
    const { conversation_type, user_tone, authenticity_concern_level, price_sensitivity } = context;

    // Strategy matrix based on context
    if (conversation_type === 'price_complaint' && price_sensitivity === 'high') {
      return 'pricing_education_with_seoul_intelligence';
    }

    if (conversation_type === 'authenticity_concern' && authenticity_concern_level === 'high') {
      return 'authenticity_expertise_with_verification_guidance';
    }

    if (conversation_type === 'help_request' && user_tone === 'confused') {
      return 'cultural_education_with_gentle_guidance';
    }

    if (conversation_type === 'routine_advice' && context.cultural_interest === 'high') {
      return 'traditional_wisdom_with_modern_application';
    }

    return 'general_cultural_insight_with_expertise_positioning';
  }

  private async getCulturalKnowledge(keywords: string[]): Promise<any> {
    // Identify the most relevant cultural knowledge based on keywords
    let category = 'general';
    let specific_knowledge = null;

    // Check for glass skin / water light terms
    if (keywords.some(k => ['glass skin', 'chok-chok', 'dewy', 'glowing'].includes(k.toLowerCase()))) {
      category = 'glass_skin_mastery';
      specific_knowledge = {
        category: 'glass_skin',
        korean_term: this.CULTURAL_KNOWLEDGE_BASE.beauty_terms.glass_skin,
        philosophy: this.CULTURAL_KNOWLEDGE_BASE.beauty_philosophy.gentle_consistency,
        traditional_technique: '7-skin method with fermented essences',
        seoul_insight: 'Current Seoul trend: layering ceramide-rich essences for maximum hydration'
      };
    }

    // Check for authenticity concerns
    else if (keywords.some(k => ['fake', 'authentic', 'real', 'counterfeit'].includes(k.toLowerCase()))) {
      category = 'authenticity_expertise';
      specific_knowledge = {
        category: 'authenticity',
        verification_methods: ['Package hologram verification', 'Ingredient list authenticity', 'Seoul retailer verification'],
        korean_standards: 'Korean FDA (KFDA) certification requirements',
        seoul_insight: 'Seoul consumers use specific apps and communities for authenticity verification'
      };
    }

    // Check for pricing concerns
    else if (keywords.some(k => ['expensive', 'overpriced', 'budget', 'affordable', 'cost'].includes(k.toLowerCase()))) {
      category = 'pricing_intelligence';
      specific_knowledge = {
        category: 'pricing',
        seoul_market_dynamics: 'Korean beauty positioned as accessible luxury in Seoul',
        markup_explanation: 'US retail markup ranges from 200-400% due to import/distribution costs',
        seoul_insight: 'Seoul wholesale markets offer authentic products at 60-70% lower than US retail'
      };
    }

    // Check for routine/technique questions
    else if (keywords.some(k => ['routine', 'steps', 'method', 'technique'].includes(k.toLowerCase()))) {
      category = 'routine_mastery';
      specific_knowledge = {
        category: 'routine',
        philosophy: this.CULTURAL_KNOWLEDGE_BASE.beauty_philosophy.prevention_over_correction,
        traditional_approach: 'Morning: gentle protection, Evening: deep nourishment',
        seoul_insight: 'Seoul women adjust routines seasonally - lighter in summer, intensive in winter'
      };
    }

    return { category, ...specific_knowledge };
  }

  private async craftPersonalizedResponse(
    context: ConversationContext,
    culturalKnowledge: any,
    strategy: string
  ): Promise<GeneratedResponse> {

    let primary_response = '';
    let cultural_insight = '';
    let pronunciation_note = '';
    let seoul_sister_mention = '';
    let follow_up_hook = '';
    let qualification_question = '';

    switch (strategy) {
      case 'pricing_education_with_seoul_intelligence':
        primary_response = `I totally understand the pricing frustration! The same Korean products that cost $15-20 in Seoul beauty stores end up being $40-60+ at US retailers. This happens because of import tariffs, distribution markups, and retailer margins that can add 200-400% to the original Seoul price.`;

        cultural_insight = `In Korea, beauty products are positioned as "accessible luxury" - high quality but reasonably priced so everyone can have good skincare. The Korean concept of "gachi" (가치) means finding true value, not just paying for brand prestige.`;

        pronunciation_note = `gachi (가치): "gah-chee" - meaning true value or worth`;

        seoul_sister_mention = `Seoul Sister actually provides real-time pricing intelligence from Seoul markets, showing exactly what products cost at their source vs US retail markup.`;

        follow_up_hook = `Have you noticed this pricing pattern with other Korean brands too?`;

        qualification_question = `Are you interested in learning about authentic Seoul sourcing options, or mainly looking for budget-friendly alternatives?`;
        break;

      case 'authenticity_expertise_with_verification_guidance':
        primary_response = `Authenticity is such a crucial concern with Korean beauty! Korean consumers are incredibly sophisticated about this - they use specific verification methods that most international buyers don't know about.`;

        cultural_insight = `In Seoul, there's a saying "jin-cha-reul al-a-bo-da" (진짜를 알아보다) meaning "to recognize the real thing." Korean beauty culture has developed detailed authenticity verification because quality is paramount.`;

        pronunciation_note = `jin-cha (진짜): "jin-chah" - meaning real or authentic`;

        seoul_sister_mention = `Seoul Sister's Korean community intelligence tracks the latest authenticity verification methods used by Seoul consumers, plus connects with verified Seoul suppliers.`;

        follow_up_hook = `What specific products are you most concerned about regarding authenticity?`;

        qualification_question = `Have you had experiences with counterfeit Korean products before, or is this more about prevention?`;
        break;

      case 'cultural_education_with_gentle_guidance':
        primary_response = `Korean skincare can seem complex at first, but it's built on beautiful, simple philosophy: "ye-bang-i chi-ryo-bo-da nat-da" - prevention is better than treatment. Instead of aggressive correction, Korean approach focuses on gentle, consistent nurturing.`;

        cultural_insight = `The traditional Korean beauty concept of "yangsaeng" (양생) means nurturing your life force through gentle care. This applies to skincare - it's about daily rituals that support your skin's natural health rather than fighting against it.`;

        pronunciation_note = `yangsaeng (양생): "yahng-seng" - nurturing life force through gentle care`;

        seoul_sister_mention = `Seoul Sister provides cultural context like this to help understand why Korean routines work differently from Western approaches - it's not just about products, but philosophy.`;

        follow_up_hook = `Does this gentler philosophy approach appeal to you for your skincare journey?`;

        qualification_question = `Are you looking to completely revamp your routine, or integrate Korean principles with what you're already doing?`;
        break;

      case 'traditional_wisdom_with_modern_application':
        if (culturalKnowledge.category === 'glass_skin') {
          primary_response = `Glass skin (유리 피부, "yu-ri pi-bu") is fascinating because it combines ancient Korean hydration techniques with modern ingredient science. The traditional approach uses the "7-skin method" - layering hydrating essences seven times - but modern Seoul applications use fermented ingredients and ceramides for enhanced absorption.`;

          cultural_insight = `In traditional Korean beauty, they believed "mul-i saeng-myeong-i-da" (물이 생명이다) - water is life. Modern Seoul skincare has evolved this into sophisticated hydration layering that creates that coveted "mul-gwang" (물광) water-light effect.`;

          pronunciation_note = `mul-gwang (물광): "mool-gwahng" - the water-light dewy skin effect`;
        } else {
          primary_response = `Korean beauty traditions have incredible wisdom that modern science is just catching up to. Traditional ingredients like ginseng, rice water, and fermented extracts are now proven to have amazing skin benefits.`;

          cultural_insight = `Korean traditional medicine concept of "dong-ui-bo-gam" guides skincare - treating the whole person, not just symptoms. This holistic approach is why Korean routines focus on long-term skin health.`;
        }

        seoul_sister_mention = `Seoul Sister's intelligence system tracks how traditional Korean techniques are being modernized in current Seoul beauty trends - it's like having insider access to Korean beauty evolution.`;

        follow_up_hook = `Are you interested in trying traditional Korean techniques, or learning how they're being modernized?`;

        qualification_question = `What draws you most to Korean beauty - the traditional wisdom, modern innovation, or the cultural approach to skincare?`;
        break;

      default:
        primary_response = `Korean beauty culture has such rich wisdom! The approach is fundamentally different from Western skincare - it's about nurturing and prevention rather than correction and treatment.`;

        cultural_insight = `Korean philosophy of "in-nae" (인내) - patience - applies perfectly to skincare. Results come from consistent, gentle care over time rather than quick fixes.`;

        pronunciation_note = `in-nae (인내): "in-neh" - patience and perseverance`;

        seoul_sister_mention = `Seoul Sister provides authentic Korean beauty cultural insights like these, plus real intelligence from Korean beauty communities.`;

        follow_up_hook = `Have you noticed differences between Korean and Western approaches to skincare?`;

        qualification_question = `Are you mainly interested in Korean products, or also the cultural philosophy behind Korean beauty?`;
    }

    const confidence_score = this.calculateConfidenceScore(context, culturalKnowledge);

    return {
      primary_response,
      cultural_insight,
      pronunciation_note,
      seoul_sister_mention,
      follow_up_hook,
      qualification_question,
      confidence_score,
      response_strategy: strategy
    };
  }

  private calculateConfidenceScore(context: ConversationContext, knowledge: any): number {
    let score = 0.5; // Base score

    // Higher confidence for well-matched keywords
    if (context.keywords_matched.length >= 3) score += 0.2;

    // Higher confidence for clear conversation types
    if (['price_complaint', 'authenticity_concern'].includes(context.conversation_type)) score += 0.2;

    // Higher confidence when we have specific cultural knowledge
    if (knowledge.category !== 'general') score += 0.15;

    // Adjust for context clarity
    if (context.intent_score > 0.8) score += 0.1;

    return Math.min(score, 0.95); // Cap at 95%
  }

  private async trackResponseUsage(category: string, effectiveness: number): Promise<void> {
    try {
      // First get current usage count
      const { data: currentData, error: fetchError } = await supabase
        .from('korean_cultural_responses')
        .select('usage_count')
        .eq('category', category)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        console.error('Error fetching current usage count:', fetchError);
        return;
      }

      const currentUsageCount = currentData?.usage_count || 0;

      // Update with incremented usage count
      await supabase
        .from('korean_cultural_responses')
        .update({
          usage_count: currentUsageCount + 1,
          engagement_effectiveness: effectiveness,
          last_used: new Date().toISOString()
        })
        .eq('category', category);
    } catch (error) {
      console.error('Error tracking response usage:', error);
    }
  }

  async getAllCulturalResponses(): Promise<CulturalResponse[]> {
    try {
      const { data, error } = await supabase
        .from('korean_cultural_responses')
        .select('*')
        .order('engagement_effectiveness', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching cultural responses:', error);
      return [];
    }
  }

  async addCulturalResponse(response: CulturalResponse): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('korean_cultural_responses')
        .insert(response);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error adding cultural response:', error);
      return false;
    }
  }
}

export default KoreanCulturalResponseEngine;