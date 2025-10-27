import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { image, prompt, maxTokens = 4000 } = await request.json()

    if (!image || !prompt) {
      return NextResponse.json({ error: 'Image and prompt are required' }, { status: 400 })
    }

    // Call Claude 3.5 Sonnet with vision capabilities
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022', // Vision-capable model for image analysis only
        max_tokens: maxTokens,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: image
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ]
      })
    })

    if (!claudeResponse.ok) {
      const error = await claudeResponse.text()
      console.error('Claude API error:', error)
      return NextResponse.json({ error: 'AI analysis failed' }, { status: 500 })
    }

    const result = await claudeResponse.json()

    return NextResponse.json({
      content: result.content[0].text,
      usage: result.usage
    })

  } catch (error) {
    console.error('Claude vision API error:', error)
    return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 })
  }
}