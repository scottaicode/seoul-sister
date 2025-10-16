import { createClient } from '@supabase/supabase-js';
import { RedditConversationDetector } from './reddit-conversation-detector';
import { KoreanCulturalResponseEngine } from './korean-cultural-response-engine';
import { ConversationQualifier } from './conversation-qualifier';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface EngagementSession {
  id: string;
  conversation_opportunity: any;
  engagement_strategy: string;
  cultural_response: any;
  conversation_thread: any;
  qualification_result?: any;
  status: 'initiated' | 'engaging' | 'qualified' | 'handed_off' | 'completed';
  performance_metrics: {
    responses_received: number;
    engagement_quality: number;
    qualification_score: number;
    conversion_probability: number;
  };
}

interface EngagementResult {
  success: boolean;
  session: EngagementSession;
  next_actions: string[];
  human_handoff_needed: boolean;
  lead_created: boolean;
  performance_insights: any;
}

export class AutonomousEngagementEngine {
  private detector: RedditConversationDetector;
  private responseEngine: KoreanCulturalResponseEngine;
  private qualifier: ConversationQualifier;

  constructor() {
    this.detector = new RedditConversationDetector();
    this.responseEngine = new KoreanCulturalResponseEngine();
    this.qualifier = new ConversationQualifier();
  }

  async runFullEngagementCycle(): Promise<EngagementResult[]> {
    try {
      console.log('🚀 Starting Autonomous AI Lead Hunter Engagement Cycle...');

      // Step 1: Detect conversation opportunities
      const opportunities = await this.detector.detectConversationOpportunities();
      console.log(`🔍 Found ${opportunities.length} conversation opportunities`);

      // Step 2: Engage with high-priority opportunities
      const engagementResults: EngagementResult[] = [];

      for (const opportunity of opportunities.slice(0, 5)) { // Process top 5 for demo
        if (opportunity.engagement_timing === 'immediate' && opportunity.confidence_score >= 0.7) {
          const result = await this.engageWithOpportunity(opportunity);
          engagementResults.push(result);
        }
      }

      // Step 3: Update analytics
      await this.updateEngagementAnalytics(engagementResults);

      console.log(`✅ Completed engagement cycle with ${engagementResults.length} conversations`);
      return engagementResults;

    } catch (error) {
      console.error('❌ Error in autonomous engagement cycle:', error);
      throw error;
    }
  }

  private async engageWithOpportunity(opportunity: any): Promise<EngagementResult> {
    try {
      console.log(`💬 Engaging with opportunity: ${opportunity.post.id}`);

      // Step 1: Generate culturally appropriate response
      const culturalResponse = await this.responseEngine.generateCulturalResponse({
        post_title: opportunity.post.title,
        post_content: opportunity.post.content,
        conversation_type: opportunity.post.conversation_type,
        intent_score: opportunity.post.intent_score,
        keywords_matched: opportunity.post.keywords_matched,
        user_tone: this.inferUserTone(opportunity.post),
        authenticity_concern_level: this.inferAuthenticityLevel(opportunity.post),
        price_sensitivity: this.inferPriceSensitivity(opportunity.post),
        cultural_interest: this.inferCulturalInterest(opportunity.post)
      });

      // Step 2: Create conversation thread
      const thread = await this.createConversationThread(opportunity, culturalResponse);

      // Step 3: Simulate initial engagement (in production, this would post to Reddit)
      const initialResponse = await this.simulateEngagement(thread, culturalResponse);

      // Step 4: Monitor for user response and continue conversation
      const conversationResult = await this.monitorAndContinueConversation(thread);

      // Step 5: Qualify the conversation
      let qualificationResult = null;
      let humanHandoffNeeded = false;
      let leadCreated = false;

      if (conversationResult.user_responses.length >= 2) {
        qualificationResult = await this.qualifier.qualifyConversation({
          id: thread.id,
          platform: 'reddit',
          original_post: opportunity.post,
          ai_responses: conversationResult.ai_responses,
          user_responses: conversationResult.user_responses,
          qualification_data: {} as any, // Will be populated by qualifier
          lead_potential: 'medium',
          handoff_ready: false
        });

        if (qualificationResult.handoff_recommendation === 'immediate') {
          humanHandoffNeeded = true;
          leadCreated = await this.createQualifiedLead(thread, qualificationResult);
        }
      }

      // Step 6: Create engagement session record
      const session: EngagementSession = {
        id: `session_${Date.now()}`,
        conversation_opportunity: opportunity,
        engagement_strategy: opportunity.response_strategy,
        cultural_response: culturalResponse,
        conversation_thread: thread,
        qualification_result: qualificationResult,
        status: humanHandoffNeeded ? 'handed_off' : (qualificationResult ? 'qualified' : 'engaging'),
        performance_metrics: {
          responses_received: conversationResult.user_responses.length,
          engagement_quality: this.calculateEngagementQuality(conversationResult),
          qualification_score: qualificationResult?.qualification_score || 0,
          conversion_probability: qualificationResult?.lead_profile?.estimated_conversion_probability || 0
        }
      };

      return {
        success: true,
        session,
        next_actions: this.generateNextActions(session),
        human_handoff_needed: humanHandoffNeeded,
        lead_created: leadCreated,
        performance_insights: this.generatePerformanceInsights(session)
      };

    } catch (error) {
      console.error('❌ Error engaging with opportunity:', error);
      throw error;
    }
  }

  private inferUserTone(post: any): 'frustrated' | 'curious' | 'skeptical' | 'excited' | 'confused' {
    const text = `${post.title} ${post.content}`.toLowerCase();

    if (/(help|confused|don't know|not sure)/.test(text)) return 'confused';
    if (/(frustrated|annoyed|tired of|sick of)/.test(text)) return 'frustrated';
    if (/(skeptical|doubt|suspicious|really\?)/.test(text)) return 'skeptical';
    if (/(excited|love|amazing|incredible)/.test(text)) return 'excited';
    return 'curious';
  }

  private inferAuthenticityLevel(post: any): 'low' | 'medium' | 'high' {
    const text = `${post.title} ${post.content}`.toLowerCase();

    if (/(fake|counterfeit|scam|burned before)/.test(text)) return 'high';
    if (/(authentic|real|genuine|legitimate)/.test(text)) return 'medium';
    return 'low';
  }

  private inferPriceSensitivity(post: any): 'low' | 'medium' | 'high' {
    const text = `${post.title} ${post.content}`.toLowerCase();

    if (/(expensive|overpriced|can't afford|budget|cheap)/.test(text)) return 'high';
    if (/(worth it|price|cost|value)/.test(text)) return 'medium';
    return 'low';
  }

  private inferCulturalInterest(post: any): 'low' | 'medium' | 'high' {
    const text = `${post.title} ${post.content}`.toLowerCase();

    if (/(korean culture|traditional|seoul|philosophy|cultural)/.test(text)) return 'high';
    if (/(korean way|korean method|korean technique)/.test(text)) return 'medium';
    return 'low';
  }

  private async createConversationThread(opportunity: any, culturalResponse: any): Promise<any> {
    const thread = {
      id: `thread_${Date.now()}_${opportunity.post.id}`,
      platform: 'reddit',
      platform_thread_id: opportunity.post.id,
      original_post_id: opportunity.post.id,
      thread_type: 'ai_engagement',
      status: 'active',
      conversation_data: {
        opportunity,
        cultural_response,
        started_at: new Date().toISOString()
      },
      messages: [],
      engagement_score: 0.0,
      qualification_score: 0.0,
      lead_potential: 'unknown',
      handoff_ready: false,
      handoff_completed: false,
      total_messages: 0,
      ai_messages: 0,
      user_responses: 0,
      created_at: new Date().toISOString()
    };

    // Store in database
    await supabase
      .from('ai_conversation_threads')
      .insert(thread);

    return thread;
  }

  private async simulateEngagement(thread: any, culturalResponse: any): Promise<any> {
    // In production, this would post to Reddit API
    // For now, simulate the engagement response

    const aiMessage = {
      id: `msg_${Date.now()}`,
      type: 'ai_response',
      content: `${culturalResponse.primary_response}\n\n${culturalResponse.cultural_insight}\n\n*${culturalResponse.pronunciation_note}*\n\n${culturalResponse.seoul_sister_mention}\n\n${culturalResponse.follow_up_hook}`,
      timestamp: new Date().toISOString(),
      response_strategy: culturalResponse.response_strategy,
      confidence_score: culturalResponse.confidence_score
    };

    // Update thread with AI message
    thread.messages.push(aiMessage);
    thread.ai_messages++;
    thread.total_messages++;
    thread.last_ai_response = new Date().toISOString();

    await this.updateConversationThread(thread);

    return aiMessage;
  }

  private async monitorAndContinueConversation(thread: any): Promise<any> {
    // In production, this would monitor Reddit for replies
    // For now, simulate realistic user responses based on conversation type

    const userResponses = this.simulateUserResponses(thread);
    const aiResponses = thread.messages.filter((m: any) => m.type === 'ai_response');

    // Continue conversation with follow-up responses
    for (const userResponse of userResponses) {
      thread.messages.push(userResponse);
      thread.user_responses++;
      thread.total_messages++;
      thread.last_user_response = new Date().toISOString();

      // Generate AI follow-up if appropriate
      const followUpResponse = await this.generateFollowUpResponse(thread, userResponse);
      if (followUpResponse) {
        thread.messages.push(followUpResponse);
        thread.ai_messages++;
        thread.total_messages++;
        thread.last_ai_response = new Date().toISOString();
        aiResponses.push(followUpResponse);
      }
    }

    await this.updateConversationThread(thread);

    return {
      ai_responses: aiResponses,
      user_responses: userResponses,
      total_exchanges: userResponses.length
    };
  }

  private simulateUserResponses(thread: any): any[] {
    const opportunity = thread.conversation_data.opportunity;
    const conversationType = opportunity.post.conversation_type;

    // Generate realistic responses based on conversation type and confidence
    const responses = [];

    if (opportunity.confidence_score > 0.8) {
      // High confidence - engaged user
      responses.push({
        id: `user_msg_${Date.now()}`,
        type: 'user_response',
        content: this.generateEngagedUserResponse(conversationType),
        timestamp: new Date(Date.now() + 1800000).toISOString(), // 30 minutes later
        engagement_quality: 0.8
      });

      if (conversationType === 'price_complaint' || conversationType === 'authenticity_concern') {
        responses.push({
          id: `user_msg_${Date.now() + 1}`,
          type: 'user_response',
          content: this.generateQualificationResponse(conversationType),
          timestamp: new Date(Date.now() + 5400000).toISOString(), // 90 minutes later
          engagement_quality: 0.9
        });
      }
    } else if (opportunity.confidence_score > 0.6) {
      // Medium confidence - moderately interested user
      responses.push({
        id: `user_msg_${Date.now()}`,
        type: 'user_response',
        content: this.generateModerateUserResponse(conversationType),
        timestamp: new Date(Date.now() + 3600000).toISOString(), // 1 hour later
        engagement_quality: 0.6
      });
    }

    return responses;
  }

  private generateEngagedUserResponse(type: string): string {
    const responses = {
      price_complaint: "Wow, I had no idea about the markup! I've been paying $50+ for products that cost $15 in Seoul? That's crazy. Seoul Sister sounds interesting - how does the verification process work? I've been burned by fake products before.",
      authenticity_concern: "Thank you for this explanation! The pronunciation guide is really helpful. I've definitely been concerned about getting fake products. Seoul Sister's verification system sounds exactly what I need. Can you tell me more about how they connect with Seoul suppliers?",
      help_request: "This is so helpful! I never understood the cultural context behind Korean skincare. The 'yangsaeng' concept makes total sense. I'm really interested in learning more about traditional techniques. Does Seoul Sister provide this kind of cultural education?",
      routine_advice: "Amazing insight about seasonal adjustments! I never thought about adapting my routine like Korean women do. The traditional wisdom combined with modern application sounds perfect. Where can I learn more about Seoul Sister's approach?"
    };

    return responses[type as keyof typeof responses] || "This is really helpful information! I'd love to learn more.";
  }

  private generateModerateUserResponse(type: string): string {
    const responses = {
      price_complaint: "Interesting point about the markup. I'm always looking for better deals on Korean skincare.",
      authenticity_concern: "Thanks for the authenticity tips. Good to know about verification methods.",
      help_request: "Helpful information! I'm still learning about Korean beauty.",
      routine_advice: "Good insights about Korean routines. Thanks for sharing."
    };

    return responses[type as keyof typeof responses] || "Thanks for the information!";
  }

  private generateQualificationResponse(type: string): string {
    const responses = {
      price_complaint: "I spend about $200-300/month on Korean skincare, so Seoul Sister's wholesale access could save me a lot. Do they have a membership or subscription? I'm definitely interested in authentic Seoul pricing.",
      authenticity_concern: "I've been burned by fakes twice - once got a completely different product than advertised. Verification and authentic Seoul suppliers would be worth paying for. What's Seoul Sister's pricing model?"
    };

    return responses[type as keyof typeof responses] || "I'm interested in learning more about Seoul Sister's services.";
  }

  private async generateFollowUpResponse(thread: any, userResponse: any): Promise<any | null> {
    // Generate contextual follow-up based on user response
    if (userResponse.content.includes('Seoul Sister') || userResponse.content.includes('interested') || userResponse.content.includes('tell me more')) {

      const followUpContent = `I'm glad you're interested! Seoul Sister specializes in exactly what you're looking for. They provide:\n\n• Real-time Seoul pricing intelligence\n• Verified authentic Korean beauty suppliers\n• Cultural education and traditional technique guidance\n• Korean community insights and trend analysis\n\nTheir premium membership gives you insider access to the Korean beauty market before trends hit the US. Would you like me to share more about their approach to authenticity verification?`;

      return {
        id: `ai_followup_${Date.now()}`,
        type: 'ai_response',
        content: followUpContent,
        timestamp: new Date(Date.now() + 1800000).toISOString(),
        response_strategy: 'qualification_and_value_prop',
        confidence_score: 0.9
      };
    }

    return null;
  }

  private async updateConversationThread(thread: any): Promise<void> {
    await supabase
      .from('ai_conversation_threads')
      .update({
        messages: thread.messages,
        total_messages: thread.total_messages,
        ai_messages: thread.ai_messages,
        user_responses: thread.user_responses,
        last_ai_response: thread.last_ai_response,
        last_user_response: thread.last_user_response,
        updated_at: new Date().toISOString()
      })
      .eq('id', thread.id);
  }

  private calculateEngagementQuality(conversationResult: any): number {
    const responses = conversationResult.user_responses;
    if (responses.length === 0) return 0;

    const avgLength = responses.reduce((sum: number, r: any) => sum + r.content.length, 0) / responses.length;
    const avgQuality = responses.reduce((sum: number, r: any) => sum + (r.engagement_quality || 0.5), 0) / responses.length;

    return Math.min((avgLength / 100) * 0.3 + avgQuality * 0.7, 1.0);
  }

  private async createQualifiedLead(thread: any, qualificationResult: any): Promise<boolean> {
    try {
      const leadData = {
        source_platform: 'reddit',
        source_thread_id: thread.id,
        source_opportunity_id: thread.conversation_data.opportunity.post.id,
        username: thread.conversation_data.opportunity.post.author,
        lead_type: qualificationResult.lead_profile.persona,
        intent_level: qualificationResult.lead_quality,
        qualification_data: qualificationResult.lead_profile,
        conversation_context: `Engaged through ${thread.conversation_data.opportunity.post.conversation_type} conversation. ${qualificationResult.lead_profile.primary_motivation}`,
        korean_beauty_interests: thread.conversation_data.opportunity.post.keywords_matched,
        authenticity_concerns: qualificationResult.lead_profile.persona === 'authenticity_seeker',
        price_sensitivity: qualificationResult.lead_profile.persona === 'budget_conscious' ? 'high' : 'medium',
        cultural_interest_level: qualificationResult.lead_profile.persona === 'cultural_enthusiast' ? 'high' : 'medium',
        handoff_notes: qualificationResult.lead_profile.recommended_approach,
        status: 'new',
        created_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('ai_generated_leads')
        .insert(leadData);

      if (error) throw error;

      console.log(`✅ Created qualified lead for ${thread.conversation_data.opportunity.post.author}`);
      return true;
    } catch (error) {
      console.error('❌ Error creating qualified lead:', error);
      return false;
    }
  }

  private generateNextActions(session: EngagementSession): string[] {
    const actions: string[] = [];

    if (session.status === 'handed_off') {
      actions.push('Human team notified of warm lead');
      actions.push(`Use ${session.qualification_result?.lead_profile.persona} messaging approach`);
      actions.push('Schedule follow-up within 24 hours');
    } else if (session.status === 'engaging') {
      actions.push('Continue monitoring conversation for responses');
      actions.push('Re-qualify when user provides additional responses');
      actions.push('Provide value-first follow-up content');
    }

    if (session.performance_metrics.engagement_quality > 0.7) {
      actions.push('High engagement quality - prioritize this conversation');
    }

    return actions;
  }

  private generatePerformanceInsights(session: EngagementSession): any {
    return {
      engagement_effectiveness: session.performance_metrics.engagement_quality,
      cultural_response_success: session.cultural_response.confidence_score,
      qualification_success: session.qualification_result ? 'qualified' : 'continuing',
      lead_quality: session.qualification_result?.lead_quality || 'unknown',
      optimization_opportunities: [
        session.performance_metrics.engagement_quality < 0.5 ? 'Improve cultural response relevance' : null,
        session.performance_metrics.responses_received === 0 ? 'Adjust engagement timing' : null,
        session.cultural_response.confidence_score < 0.7 ? 'Enhance keyword matching' : null
      ].filter(Boolean)
    };
  }

  private async updateEngagementAnalytics(results: EngagementResult[]): Promise<void> {
    const analytics = {
      date: new Date().toISOString().split('T')[0],
      platform: 'reddit',
      opportunities_detected: results.length,
      conversations_initiated: results.filter(r => r.success).length,
      responses_received: results.reduce((sum, r) => sum + r.session.performance_metrics.responses_received, 0),
      leads_qualified: results.filter(r => r.session.qualification_result?.qualified).length,
      leads_handed_off: results.filter(r => r.human_handoff_needed).length,
      conversions: results.filter(r => r.lead_created).length,
      avg_qualification_score: results.length > 0
        ? results.reduce((sum, r) => sum + (r.session.qualification_result?.qualification_score || 0), 0) / results.length
        : 0,
      performance_metrics: {
        engagement_success_rate: results.filter(r => r.session.performance_metrics.responses_received > 0).length / results.length,
        qualification_rate: results.filter(r => r.session.qualification_result?.qualified).length / results.length,
        handoff_rate: results.filter(r => r.human_handoff_needed).length / results.length
      }
    };

    await supabase
      .from('lead_hunter_analytics')
      .upsert(analytics, { onConflict: 'date,platform' });
  }

  async getEngagementAnalytics(days: number = 7): Promise<any> {
    const { data, error } = await supabase
      .from('lead_hunter_analytics')
      .select('*')
      .eq('platform', 'reddit')
      .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('date', { ascending: false });

    if (error) throw error;

    return {
      daily_metrics: data,
      summary: {
        total_opportunities: data?.reduce((sum, d) => sum + d.opportunities_detected, 0) || 0,
        total_conversations: data?.reduce((sum, d) => sum + d.conversations_initiated, 0) || 0,
        total_leads: data?.reduce((sum, d) => sum + d.leads_qualified, 0) || 0,
        avg_engagement_rate: data?.length > 0
          ? data.reduce((sum, d) => sum + (d.performance_metrics?.engagement_success_rate || 0), 0) / data.length
          : 0
      }
    };
  }
}

export default AutonomousEngagementEngine;