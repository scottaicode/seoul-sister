import { NextRequest, NextResponse } from 'next/server';
import { KoreanCulturalResponseEngine } from '@/lib/ai-lead-hunter/korean-cultural-response-engine';

export async function POST(request: NextRequest) {
  try {
    const context = await request.json();

    console.log('🧪 Testing Korean Cultural Response Generation...');

    const responseEngine = new KoreanCulturalResponseEngine();
    const culturalResponse = await responseEngine.generateCulturalResponse(context);

    return NextResponse.json({
      success: true,
      message: 'Korean cultural response generated successfully',
      input_context: context,
      generated_response: culturalResponse,
      korean_cultural_demonstration: {
        authentic_knowledge: 'Response includes genuine Korean beauty philosophy and cultural insights',
        pronunciation_guides: 'Korean terms include romanized pronunciation for authenticity',
        traditional_wisdom: 'Incorporates traditional Korean beauty principles',
        seoul_sister_positioning: 'Naturally integrates Seoul Sister value proposition',
        engagement_strategy: 'Designed to build trust through cultural authority'
      },
      system_capabilities: [
        'Korean language integration with pronunciation guides',
        'Traditional beauty philosophy and modern application',
        'Cultural context for authentic engagement',
        'Seoul Sister brand positioning through expertise',
        'Confidence scoring for response quality assessment'
      ]
    });

  } catch (error) {
    console.error('❌ Korean Cultural Response Test Error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      system_status: 'Korean cultural response engine needs attention'
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Korean Cultural Response Engine Test',
    description: 'Demonstrates Seoul Sister\'s authentic Korean beauty cultural intelligence',
    test_scenarios: {
      'help_request': 'User asking for Korean skincare advice - showcases cultural authority',
      'authenticity_concern': 'User worried about fake products - demonstrates verification expertise',
      'price_complaint': 'User frustrated with Korean beauty pricing - reveals Seoul wholesale advantage',
      'cultural_curiosity': 'User interested in Korean beauty culture - educational opportunity'
    },
    korean_knowledge_base: [
      'Traditional Korean beauty philosophy (양생 yangsaeng)',
      'Authentic pronunciation guides for Korean terms',
      'Cultural context for skincare ingredients and techniques',
      'Seoul market intelligence and pricing insights',
      'Traditional wisdom with modern application'
    ],
    seoul_sister_advantages: [
      'Unmatched Korean cultural authority',
      'Authentic engagement that competitors cannot replicate',
      'Cultural knowledge creates trust and credibility',
      'Educational approach builds lasting customer relationships'
    ],
    endpoint: 'POST /api/test-korean-response'
  });
}