import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { image, prompt, maxTokens = 4000, imageType } = await request.json()

    if (!image || !prompt) {
      return NextResponse.json({ error: 'Image and prompt are required' }, { status: 400 })
    }

    // Clean base64 data (remove data URL prefix if present)
    let cleanBase64 = image
    if (image.startsWith('data:')) {
      cleanBase64 = image.split(',')[1]
    }

    // Determine media type from imageType or default to JPEG
    let mediaType = 'image/jpeg'
    if (imageType) {
      if (imageType.includes('png')) mediaType = 'image/png'
      else if (imageType.includes('webp')) mediaType = 'image/webp'
      else if (imageType.includes('gif')) mediaType = 'image/gif'
    }

    console.log('🔍 Claude Vision API called:', {
      imageSize: cleanBase64.length,
      mediaType,
      promptLength: prompt.length
    })

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
                  media_type: mediaType,
                  data: cleanBase64
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