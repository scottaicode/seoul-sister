import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { prompt, model = 'claude-opus-4.1' } = await request.json()

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      )
    }

    // Use the same Claude API configuration as the Instagram story generator
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 300,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      })
    })

    if (!response.ok) {
      const errorData = await response.text()
      console.error('Claude API Error:', errorData)
      throw new Error(`Claude API failed: ${response.status}`)
    }

    const data = await response.json()

    if (!data.content || !data.content[0]?.text) {
      throw new Error('Invalid response from Claude API')
    }

    return NextResponse.json({
      recommendation: data.content[0].text.trim(),
      model: 'claude-3-5-sonnet-20241022'
    })

  } catch (error) {
    console.error('Error in AI analysis:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate AI analysis',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}