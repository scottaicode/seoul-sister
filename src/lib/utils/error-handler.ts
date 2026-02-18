import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: 'Validation error', details: error.errors },
      { status: 400 }
    )
  }

  if (error instanceof AppError) {
    // Don't expose internal error details for 500s
    const safeMessage = error.statusCode >= 500 ? 'Internal server error' : error.message
    if (error.statusCode >= 500) {
      console.error('AppError 5xx:', error.message)
    }
    return NextResponse.json(
      { error: safeMessage, code: error.code },
      { status: error.statusCode }
    )
  }

  if (error instanceof Error) {
    console.error('Unhandled error:', error.message)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }

  console.error('Unknown error:', error)
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  )
}
