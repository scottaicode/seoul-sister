import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, post } = await request.json();

    // Use Claude Opus 4.1 for advanced K-beauty analysis
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-1-20250805',
        max_tokens: 1000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.status}`);
    }

    const data = await response.json();
    const analysisText = data.content[0].text;

    try {
      // Parse Claude's JSON response
      const analysis = JSON.parse(analysisText);

      // Validate and sanitize the response
      const sanitizedAnalysis = {
        detectedBrands: Array.isArray(analysis.detectedBrands) ? analysis.detectedBrands : [],
        detectedIngredients: Array.isArray(analysis.detectedIngredients) ? analysis.detectedIngredients : [],
        detectedProducts: Array.isArray(analysis.detectedProducts) ? analysis.detectedProducts : [],
        skinConcerns: Array.isArray(analysis.skinConcerns) ? analysis.skinConcerns : [],
        routineType: analysis.routineType || null,
        priceMentions: Array.isArray(analysis.priceMentions) ? analysis.priceMentions : [],
        sentimentScore: typeof analysis.sentimentScore === 'number' ? analysis.sentimentScore : 0.5,
        isQuestion: Boolean(analysis.isQuestion),
        isReview: Boolean(analysis.isReview),
        isRoutine: Boolean(analysis.isRoutine),
        aiConfidence: typeof analysis.aiConfidence === 'number' ? analysis.aiConfidence : 0.5
      };

      return NextResponse.json(sanitizedAnalysis);
    } catch (parseError) {
      console.error('❌ Failed to parse Claude response:', parseError);

      // Fallback: basic analysis
      return NextResponse.json({
        detectedBrands: [],
        detectedIngredients: [],
        detectedProducts: [],
        skinConcerns: [],
        routineType: null,
        priceMentions: [],
        sentimentScore: 0.5,
        isQuestion: post.title?.includes('?') || false,
        isReview: post.title?.toLowerCase().includes('review') || false,
        isRoutine: post.title?.toLowerCase().includes('routine') || false,
        aiConfidence: 0.1
      });
    }
  } catch (error) {
    console.error('❌ AI analysis error:', error);

    return NextResponse.json(
      { error: 'Failed to analyze post' },
      { status: 500 }
    );
  }
}