import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { text, domain } = await request.json();

    const prompt = `
Analyze this Korean beauty community text and discover emerging keywords and trends:

Text Sample:
${text.substring(0, 3000)}

Discover:
1. New Korean beauty brand names not in common lists
2. Emerging ingredient names or combinations
3. New product types or categories
4. Trending techniques or methods
5. Slang terms or community-specific language

For each discovered term, determine:
- Term frequency in the text
- Type (brand, ingredient, product, technique, slang)
- Whether it appears to be of Korean origin
- Confidence level (0-1)
- Brief reasoning for why it's significant

Return JSON array format:
[
  {
    "term": "discovered_term",
    "type": "brand|ingredient|product|technique|slang",
    "frequency": 5,
    "korean_origin": true,
    "confidence": 0.85,
    "reasoning": "Appears frequently in product recommendation contexts"
  }
]

Focus on terms that appear multiple times and seem significant to the Korean beauty community.
Exclude common English words and known mainstream terms.
`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
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
      let keywords = JSON.parse(analysisText);

      // Ensure it's an array
      if (!Array.isArray(keywords)) {
        keywords = [];
      }

      // Validate and filter keywords
      const validKeywords = keywords
        .filter((k: any) =>
          k.term &&
          k.type &&
          k.frequency >= 2 &&
          k.confidence >= 0.5
        )
        .map((k: any) => ({
          term: k.term.toLowerCase().trim(),
          type: k.type,
          frequency: Math.max(1, Math.min(100, k.frequency)),
          korean_origin: Boolean(k.korean_origin),
          confidence: Math.max(0, Math.min(1, k.confidence)),
          reasoning: k.reasoning || 'AI discovered trend'
        }))
        .slice(0, 20); // Limit to top 20

      console.log(`🔍 Discovered ${validKeywords.length} new keywords from text analysis`);

      return NextResponse.json({
        keywords: validKeywords,
        analysis_confidence: validKeywords.length > 0 ? 0.8 : 0.2,
        processed_characters: text.length
      });

    } catch (parseError) {
      console.error('❌ Failed to parse keyword discovery response:', parseError);

      return NextResponse.json({
        keywords: [],
        analysis_confidence: 0.1,
        processed_characters: text.length,
        error: 'Failed to parse AI response'
      });
    }

  } catch (error) {
    console.error('❌ Keyword discovery error:', error);

    return NextResponse.json(
      { error: 'Failed to discover keywords' },
      { status: 500 }
    );
  }
}