import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { prompt, maxTokens = 4000, context } = await request.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    // Call Claude Opus 4.1 - the most powerful model for complex reasoning
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229', // Claude Opus 4.1 - Maximum intelligence
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: context ? `Context: ${context}\n\nPrompt: ${prompt}` : prompt
          }
        ],
        temperature: 0.3 // Balanced for accuracy and creativity
      })
    })

    if (!claudeResponse.ok) {
      const error = await claudeResponse.text()
      console.error('Claude Opus API error:', error)
      return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 })
    }

    const result = await claudeResponse.json()

    return NextResponse.json({
      content: result.content[0].text,
      usage: result.usage,
      model: 'claude-opus-4.1',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Claude Opus API error:', error)
    return NextResponse.json({ error: 'Failed to process with Claude Opus' }, { status: 500 })
  }
}