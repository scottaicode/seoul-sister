import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface LeadHandoff {
  id: number;
  username: string;
  lead_type: string;
  intent_level: string;
  conversation_context: string;
  qualification_data: any;
  handoff_notes: string;
  status: string;
  created_at: string;
  source_platform: string;
  korean_beauty_interests: string[];
  authenticity_concerns: boolean;
  price_sensitivity: string;
  cultural_interest_level: string;
}

interface HandoffPlan {
  lead: LeadHandoff;
  recommended_approach: string;
  conversation_starters: string[];
  value_propositions: string[];
  objection_handling: any;
  follow_up_sequence: string[];
  success_metrics: any;
}

export async function POST(request: NextRequest) {
  try {
    const { action = 'get_pending_handoffs', lead_id } = await request.json();

    console.log(`📥 Lead Handoff System: ${action}`);

    switch (action) {
      case 'get_pending_handoffs':
        return await getPendingHandoffs();

      case 'get_handoff_plan':
        return await getHandoffPlan(lead_id);

      case 'mark_contacted':
        return await markLeadContacted(lead_id);

      case 'update_lead_status':
        return await updateLeadStatus(request);

      case 'get_handoff_analytics':
        return await getHandoffAnalytics();

      default:
        return await getPendingHandoffs();
    }

  } catch (error) {
    console.error('❌ Lead Handoff Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

async function getPendingHandoffs() {
  try {
    const { data: pendingLeads, error } = await supabase
      .from('ai_generated_leads')
      .select('*')
      .in('status', ['new', 'contacted'])
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) throw error;

    // Prioritize leads by quality and urgency
    const prioritizedLeads = pendingLeads?.sort((a, b) => {
      const priorityScore = (lead: any) => {
        let score = 0;

        // Higher priority for premium leads
        if (lead.intent_level === 'premium') score += 10;
        else if (lead.intent_level === 'high') score += 7;
        else if (lead.intent_level === 'medium') score += 4;

        // Higher priority for authenticity seekers and price complainers
        if (lead.lead_type === 'authenticity_seeker') score += 8;
        if (lead.lead_type === 'budget_conscious') score += 7;

        // Higher priority for recent leads
        const hoursOld = (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60);
        if (hoursOld < 24) score += 5;
        else if (hoursOld < 48) score += 3;

        return score;
      };

      return priorityScore(b) - priorityScore(a);
    }) || [];

    // Generate handoff summaries
    const handoffSummaries = prioritizedLeads.map(lead => ({
      id: lead.id,
      username: lead.username,
      lead_type: lead.lead_type,
      intent_level: lead.intent_level,
      status: lead.status,
      created_at: lead.created_at,
      hours_since_creation: Math.round((Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60)),
      quick_summary: generateQuickSummary(lead),
      priority_score: getPriorityLabel(lead),
      recommended_action: getRecommendedAction(lead)
    }));

    const analytics = {
      total_pending: pendingLeads?.length || 0,
      new_leads: pendingLeads?.filter(l => l.status === 'new').length || 0,
      contacted_leads: pendingLeads?.filter(l => l.status === 'contacted').length || 0,
      premium_leads: pendingLeads?.filter(l => l.intent_level === 'premium').length || 0,
      urgent_handoffs: pendingLeads?.filter(l => {
        const hoursOld = (Date.now() - new Date(l.created_at).getTime()) / (1000 * 60 * 60);
        return hoursOld < 24 && l.status === 'new';
      }).length || 0
    };

    return NextResponse.json({
      success: true,
      message: `${analytics.total_pending} leads ready for handoff`,
      pending_handoffs: handoffSummaries,
      analytics,
      next_actions: [
        `Contact ${analytics.new_leads} new leads within 24 hours`,
        `Follow up on ${analytics.contacted_leads} contacted leads`,
        `Prioritize ${analytics.premium_leads} premium leads for immediate attention`
      ]
    });

  } catch (error) {
    console.error('Error getting pending handoffs:', error);
    throw error;
  }
}

async function getHandoffPlan(leadId: number) {
  try {
    const { data: lead, error } = await supabase
      .from('ai_generated_leads')
      .select('*')
      .eq('id', leadId)
      .single();

    if (error) throw error;
    if (!lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    // Generate comprehensive handoff plan
    const handoffPlan = generateHandoffPlan(lead);

    return NextResponse.json({
      success: true,
      message: `Handoff plan for ${lead.username}`,
      handoff_plan: handoffPlan,
      conversation_intelligence: {
        original_conversation_type: getConversationTypeFromNotes(lead.handoff_notes),
        key_pain_points: extractPainPoints(lead),
        motivation_level: lead.intent_level,
        seoul_sister_fit_score: calculateSeoulSisterFit(lead)
      }
    });

  } catch (error) {
    console.error('Error generating handoff plan:', error);
    throw error;
  }
}

async function markLeadContacted(leadId: number) {
  try {
    const { error } = await supabase
      .from('ai_generated_leads')
      .update({
        status: 'contacted',
        contacted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', leadId);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: 'Lead marked as contacted',
      next_steps: [
        'Schedule follow-up in 48-72 hours',
        'Track engagement with Seoul Sister content',
        'Monitor for conversion signals'
      ]
    });

  } catch (error) {
    console.error('Error marking lead contacted:', error);
    throw error;
  }
}

async function updateLeadStatus(request: NextRequest) {
  try {
    const { lead_id, status, conversion_value, notes } = await request.json();

    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    if (status === 'converted') {
      updateData.converted_at = new Date().toISOString();
      updateData.conversion_value = conversion_value || 20; // $20 monthly subscription
    }

    const { error } = await supabase
      .from('ai_generated_leads')
      .update(updateData)
      .eq('id', lead_id);

    if (error) throw error;

    return NextResponse.json({
      success: true,
      message: `Lead status updated to ${status}`,
      conversion_tracking: status === 'converted' ? {
        conversion_value: updateData.conversion_value,
        attribution: 'AI Lead Hunter → Human Handoff → Conversion',
        roi_calculation: 'Pure profit - zero acquisition cost'
      } : null
    });

  } catch (error) {
    console.error('Error updating lead status:', error);
    throw error;
  }
}

async function getHandoffAnalytics() {
  try {
    const { data: allLeads, error } = await supabase
      .from('ai_generated_leads')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const now = Date.now();
    const last30Days = allLeads?.filter(lead =>
      (now - new Date(lead.created_at).getTime()) <= (30 * 24 * 60 * 60 * 1000)
    ) || [];

    const analytics = {
      total_leads_generated: allLeads?.length || 0,
      last_30_days: {
        leads_generated: last30Days.length,
        leads_contacted: last30Days.filter(l => l.status !== 'new').length,
        leads_converted: last30Days.filter(l => l.status === 'converted').length,
        conversion_rate: last30Days.length > 0
          ? (last30Days.filter(l => l.status === 'converted').length / last30Days.length) * 100
          : 0,
        total_revenue: last30Days
          .filter(l => l.status === 'converted')
          .reduce((sum, l) => sum + (l.conversion_value || 20), 0)
      },
      lead_quality_breakdown: {
        premium: last30Days.filter(l => l.intent_level === 'premium').length,
        high: last30Days.filter(l => l.intent_level === 'high').length,
        medium: last30Days.filter(l => l.intent_level === 'medium').length
      },
      persona_performance: getPersonaPerformance(last30Days),
      handoff_timing_analysis: getHandoffTimingAnalysis(last30Days),
      roi_metrics: {
        cost_per_lead: 0, // AI automation - no direct cost
        revenue_per_lead: last30Days.length > 0
          ? last30Days.reduce((sum, l) => sum + (l.conversion_value || 0), 0) / last30Days.length
          : 0,
        payback_period: '0 days', // Immediate ROI since no acquisition cost
        lifetime_value_projection: last30Days.filter(l => l.status === 'converted').length * 240 // 12 months * $20
      }
    };

    return NextResponse.json({
      success: true,
      message: 'Lead handoff analytics retrieved',
      analytics,
      performance_insights: [
        `${analytics.last_30_days.conversion_rate.toFixed(1)}% conversion rate from AI-generated leads`,
        `$${analytics.last_30_days.total_revenue} revenue generated in last 30 days`,
        `Zero acquisition cost = 100% profit margin on AI leads`,
        `${analytics.lead_quality_breakdown.premium} premium leads require immediate attention`
      ],
      optimization_opportunities: [
        analytics.last_30_days.conversion_rate < 30 ? 'Improve handoff messaging and timing' : null,
        analytics.handoff_timing_analysis.avg_response_time > 24 ? 'Reduce time to first contact' : null,
        analytics.lead_quality_breakdown.premium < analytics.lead_quality_breakdown.medium ? 'Focus on higher-intent conversations' : null
      ].filter(Boolean)
    });

  } catch (error) {
    console.error('Error getting handoff analytics:', error);
    throw error;
  }
}

function generateQuickSummary(lead: LeadHandoff): string {
  const summaries = {
    authenticity_seeker: `Needs verified authentic Korean products. High conversion potential.`,
    budget_conscious: `Price-sensitive, wants Seoul wholesale access. Focus on savings.`,
    cultural_enthusiast: `Interested in Korean beauty culture. Educational approach works.`,
    premium_buyer: `High-value customer seeking expert guidance. Premium positioning.`,
    skeptical_researcher: `Needs proof of value. Build trust gradually with evidence.`
  };

  return summaries[lead.lead_type as keyof typeof summaries] || 'Korean beauty lead with medium interest level.';
}

function getPriorityLabel(lead: LeadHandoff): string {
  const hoursOld = (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60);

  if (lead.intent_level === 'premium') return '🔥 URGENT';
  if (lead.intent_level === 'high' && hoursOld < 24) return '⚡ HIGH';
  if (hoursOld < 12) return '🎯 FRESH';
  if (hoursOld > 72) return '⏰ AGING';
  return '📋 STANDARD';
}

function getRecommendedAction(lead: LeadHandoff): string {
  const hoursOld = (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60);

  if (lead.status === 'new' && hoursOld < 24) return 'Contact immediately';
  if (lead.status === 'new') return 'Priority contact needed';
  if (lead.status === 'contacted' && hoursOld > 72) return 'Follow up required';
  return 'Monitor engagement';
}

function generateHandoffPlan(lead: LeadHandoff): HandoffPlan {
  const personaStrategies = {
    authenticity_seeker: {
      approach: 'Lead with Seoul Sister\'s verification credentials and authentic supplier network',
      conversation_starters: [
        "I saw your interest in authentic Korean beauty products - I completely understand the concern about fakes.",
        "Seoul Sister specializes in exactly what you\'re looking for - verified authentic Korean beauty with supplier verification.",
        "Our Korean community has helped thousands avoid counterfeit products. Would you like to know how we verify authenticity?"
      ],
      value_props: [
        'Direct verification from Seoul suppliers',
        'Authenticity guarantee with money-back promise',
        'Korean community verification network',
        'Real-time Seoul market intelligence'
      ],
      objections: {
        "How do I know Seoul Sister is legitimate?": "We provide transparent supplier verification, member testimonials, and you can verify our Korean community connections. Plus we offer a 7-day free trial.",
        "I've been burned before by fake products": "That's exactly why Seoul Sister exists. Our verification system and direct Seoul supplier network eliminates that risk completely.",
        "This sounds too good to be true": "I understand the skepticism. Our 7-day free trial lets you experience the intelligence and verification system with no risk."
      }
    },
    budget_conscious: {
      approach: 'Focus on Seoul Sister\'s pricing intelligence and wholesale access savings',
      conversation_starters: [
        "I noticed your frustration with Korean beauty pricing - the markup is honestly shocking when you see Seoul prices.",
        "Seoul Sister members save 60-70% through our Seoul wholesale access. The pricing intelligence alone pays for itself.",
        "What you\'re paying $50 for at Sephora costs $15-20 in Seoul. Our members get authentic access at fair prices."
      ],
      value_props: [
        'Seoul wholesale pricing access',
        '60-70% savings vs US retail markup',
        'Real-time Seoul pricing intelligence',
        'No distributor middleman costs'
      ],
      objections: {
        "How much does Seoul Sister cost?": "$20/month with 7-day free trial. Most members save that in their first order through wholesale access.",
        "Can\'t I just buy direct from Korea myself?": "You could, but navigating Korean suppliers, verifying authenticity, and understanding cultural context takes expertise. We provide the intelligence and connections.",
        "Is the savings really that significant?": "Absolutely. Members regularly save $30-100+ per order. The $20 membership pays for itself with one wholesale purchase."
      }
    },
    cultural_enthusiast: {
      approach: 'Emphasize Seoul Sister\'s cultural intelligence and educational value',
      conversation_starters: [
        "I love that you\'re interested in authentic Korean beauty culture - that\'s exactly what Seoul Sister provides.",
        "Our Korean cultural intelligence goes beyond products to traditional techniques, philosophy, and authentic practices.",
        "Seoul Sister offers the cultural education and context that makes Korean beauty truly effective."
      ],
      value_props: [
        'Korean beauty cultural education',
        'Traditional technique guidance with pronunciation',
        'Seoul community insights and trends',
        'Cultural context for authentic practices'
      ],
      objections: {
        "Can\'t I learn Korean beauty culture online?": "You can find basic information, but Seoul Sister provides insider cultural intelligence and real Korean community insights you won\'t find elsewhere.",
        "Do I need cultural knowledge to use Korean products?": "Not required, but understanding the cultural context makes Korean beauty significantly more effective. It\'s the difference between using products vs practicing a philosophy.",
        "Is this just marketing around regular products?": "Not at all. Seoul Sister provides actual Korean community intelligence, traditional techniques, and cultural education that enhances your entire beauty approach."
      }
    },
    premium_buyer: {
      approach: 'Position Seoul Sister as premium intelligence service with expert curation',
      conversation_starters: [
        "I can see you appreciate quality Korean beauty - Seoul Sister provides the expert intelligence and curation for sophisticated enthusiasts.",
        "Our premium members get insider access to Seoul beauty trends and expert product intelligence before they hit global markets.",
        "Seoul Sister offers the level of expertise and cultural intelligence that serious Korean beauty enthusiasts need."
      ],
      value_props: [
        'Expert Korean beauty curation',
        'Premium Seoul intelligence access',
        'Personalized guidance and recommendations',
        'Early access to trending Korean innovations'
      ],
      objections: {
        "What makes Seoul Sister premium?": "Our Korean cultural intelligence, expert curation, and direct Seoul community insights provide value unavailable elsewhere. Plus early access to trends 3-6 months before global launch.",
        "I already have good Korean beauty sources": "Seoul Sister complements your existing sources by providing cultural intelligence, trend forecasting, and authenticity verification that enhances everything else.",
        "Is $20/month worth it for beauty information?": "For serious Korean beauty enthusiasts, the cultural intelligence, early trend access, and expert curation easily provides $100+ value monthly."
      }
    },
    skeptical_researcher: {
      approach: 'Provide evidence, transparency, and gradual trust building',
      conversation_starters: [
        "I appreciate that you research thoroughly - Seoul Sister provides transparent intelligence you can verify.",
        "Let me share some specific examples of our Korean beauty intelligence so you can evaluate the value yourself.",
        "Seoul Sister offers a 7-day free trial specifically for people like you who want to verify value before committing."
      ],
      value_props: [
        'Transparent, verifiable intelligence',
        'Free trial to evaluate value',
        'Evidence-based Korean beauty insights',
        'No-risk opportunity to experience service'
      ],
      objections: {
        "How do I know this information is accurate?": "Great question. Our intelligence comes from direct Korean community sources, and you can verify accuracy during your free trial.",
        "This seems like a lot of marketing claims": "I understand. That\'s why we offer the 7-day free trial - you can experience the actual intelligence and make your own judgment.",
        "What if I\'m not satisfied?": "Zero risk with our 7-day free trial. If the Korean beauty intelligence doesn\'t provide clear value, simply cancel with no charges."
      }
    }
  };

  const strategy = personaStrategies[lead.lead_type as keyof typeof personaStrategies] || personaStrategies.skeptical_researcher;

  return {
    lead,
    recommended_approach: strategy.approach,
    conversation_starters: strategy.conversation_starters,
    value_propositions: strategy.value_props,
    objection_handling: strategy.objections,
    follow_up_sequence: [
      'Day 1: Initial contact with personalized approach',
      'Day 3: Share specific Seoul Sister intelligence relevant to their interests',
      'Day 7: Offer 7-day free trial with no risk',
      'Day 10: Follow up on trial experience and address questions',
      'Day 14: Final conversion attempt with special offer if needed'
    ],
    success_metrics: {
      response_rate_target: '60%+',
      trial_conversion_target: '40%+',
      trial_to_paid_target: '50%+',
      timeline_to_conversion: '7-14 days'
    }
  };
}

function getConversationTypeFromNotes(notes: string): string {
  if (notes.includes('price') || notes.includes('expensive')) return 'price_complaint';
  if (notes.includes('authentic') || notes.includes('fake')) return 'authenticity_concern';
  if (notes.includes('help') || notes.includes('advice')) return 'help_request';
  if (notes.includes('routine') || notes.includes('technique')) return 'routine_advice';
  return 'product_question';
}

function extractPainPoints(lead: LeadHandoff): string[] {
  const painPoints = [];

  if (lead.authenticity_concerns) painPoints.push('Worried about fake Korean products');
  if (lead.price_sensitivity === 'high') painPoints.push('Frustrated with US retail markup');
  if (lead.korean_beauty_interests.includes('routine')) painPoints.push('Needs Korean skincare guidance');
  if (lead.cultural_interest_level === 'high') painPoints.push('Wants authentic Korean cultural context');

  return painPoints.length > 0 ? painPoints : ['General Korean beauty interest'];
}

function calculateSeoulSisterFit(lead: LeadHandoff): number {
  let fit = 0.5; // Base fit

  if (lead.authenticity_concerns) fit += 0.3;
  if (lead.price_sensitivity === 'high') fit += 0.2;
  if (lead.cultural_interest_level === 'high') fit += 0.2;
  if (lead.intent_level === 'premium' || lead.intent_level === 'high') fit += 0.1;

  return Math.min(fit, 1.0);
}

function getPersonaPerformance(leads: any[]) {
  const personas = ['authenticity_seeker', 'budget_conscious', 'cultural_enthusiast', 'premium_buyer', 'skeptical_researcher'];

  return personas.map(persona => {
    const personaLeads = leads.filter(l => l.lead_type === persona);
    const converted = personaLeads.filter(l => l.status === 'converted');

    return {
      persona,
      total_leads: personaLeads.length,
      conversions: converted.length,
      conversion_rate: personaLeads.length > 0 ? (converted.length / personaLeads.length) * 100 : 0
    };
  });
}

function getHandoffTimingAnalysis(leads: any[]) {
  const contactedLeads = leads.filter(l => l.contacted_at);

  if (contactedLeads.length === 0) {
    return { avg_response_time: 0, fastest_response: 0, slowest_response: 0 };
  }

  const responseTimes = contactedLeads.map(lead => {
    const created = new Date(lead.created_at).getTime();
    const contacted = new Date(lead.contacted_at).getTime();
    return (contacted - created) / (1000 * 60 * 60); // Hours
  });

  return {
    avg_response_time: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
    fastest_response: Math.min(...responseTimes),
    slowest_response: Math.max(...responseTimes)
  };
}

export async function GET() {
  return NextResponse.json({
    message: 'AI Lead Hunter - Lead Handoff & Tracking System',
    description: 'Manages warm lead handoffs from AI conversations to human Seoul Sister team with complete context and conversion optimization',
    features: [
      'Prioritized lead queue with urgency scoring',
      'Personalized handoff plans for each lead persona',
      'Conversation context and cultural intelligence transfer',
      'Objection handling scripts based on AI conversation analysis',
      'Follow-up sequences optimized for Korean beauty leads',
      'Conversion tracking and ROI analytics'
    ],
    lead_personas: {
      'authenticity_seeker': 'Focus on verification credentials and authentic supplier network',
      'budget_conscious': 'Emphasize Seoul wholesale pricing and savings intelligence',
      'cultural_enthusiast': 'Highlight Korean beauty cultural education and traditional techniques',
      'premium_buyer': 'Position as premium intelligence service with expert curation',
      'skeptical_researcher': 'Provide evidence and transparency with free trial offer'
    },
    handoff_process: {
      'detection': 'AI identifies qualified leads through conversation analysis',
      'prioritization': 'Leads ranked by intent level, persona fit, and timing urgency',
      'context_transfer': 'Complete conversation history and cultural insights provided',
      'personalized_approach': 'Custom messaging strategy based on AI qualification data',
      'follow_up_automation': 'Structured sequence for maximum conversion probability'
    },
    success_metrics: {
      'target_response_rate': '60%+ (vs 2-5% cold outreach)',
      'target_trial_conversion': '40%+ (pre-qualified warm leads)',
      'target_paid_conversion': '50%+ trial to paid subscription',
      'roi_advantage': 'Zero acquisition cost = 100% profit margin'
    },
    endpoints: {
      'POST /api/lead-hunter/lead-handoff': {
        description: 'Manage AI-generated lead handoffs and tracking',
        actions: [
          'get_pending_handoffs - Prioritized queue of leads ready for human contact',
          'get_handoff_plan - Detailed conversion plan for specific lead',
          'mark_contacted - Update lead status when human team makes contact',
          'update_lead_status - Track lead progression through conversion funnel',
          'get_handoff_analytics - Performance metrics and ROI analysis'
        ]
      }
    }
  });
}