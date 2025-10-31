/**
 * Centralized Error Handling System
 * Provides consistent error handling and logging across the application
 */

import { NextResponse } from 'next/server'

// Error types
export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  AUTHENTICATION = 'AUTHENTICATION_ERROR',
  AUTHORIZATION = 'AUTHORIZATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  EXTERNAL_API = 'EXTERNAL_API_ERROR',
  DATABASE = 'DATABASE_ERROR',
  PAYMENT = 'PAYMENT_ERROR',
  INTERNAL = 'INTERNAL_ERROR'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

// Custom error class
export class AppError extends Error {
  public readonly type: ErrorType
  public readonly statusCode: number
  public readonly severity: ErrorSeverity
  public readonly isOperational: boolean
  public readonly metadata?: Record<string, unknown>

  constructor(
    message: string,
    type: ErrorType = ErrorType.INTERNAL,
    statusCode: number = 500,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    isOperational: boolean = true,
    metadata?: Record<string, unknown>
  ) {
    super(message)
    Object.setPrototypeOf(this, AppError.prototype)

    this.type = type
    this.statusCode = statusCode
    this.severity = severity
    this.isOperational = isOperational
    this.metadata = metadata

    Error.captureStackTrace(this, this.constructor)
  }
}

// Predefined error classes
export class ValidationError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, ErrorType.VALIDATION, 400, ErrorSeverity.LOW, true, metadata)
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, ErrorType.AUTHENTICATION, 401, ErrorSeverity.MEDIUM)
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, ErrorType.AUTHORIZATION, 403, ErrorSeverity.MEDIUM)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, ErrorType.NOT_FOUND, 404, ErrorSeverity.LOW)
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, ErrorType.CONFLICT, 409, ErrorSeverity.LOW)
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter?: number) {
    super(
      'Too many requests',
      ErrorType.RATE_LIMIT,
      429,
      ErrorSeverity.LOW,
      true,
      { retryAfter }
    )
  }
}

export class ExternalAPIError extends AppError {
  constructor(service: string, originalError?: Error) {
    super(
      `External API error: ${service}`,
      ErrorType.EXTERNAL_API,
      502,
      ErrorSeverity.HIGH,
      true,
      { service, originalError: originalError?.message }
    )
  }
}

export class DatabaseError extends AppError {
  constructor(operation: string, originalError?: Error) {
    super(
      `Database operation failed: ${operation}`,
      ErrorType.DATABASE,
      500,
      ErrorSeverity.HIGH,
      true,
      { operation, originalError: originalError?.message }
    )
  }
}

export class PaymentError extends AppError {
  constructor(message: string, metadata?: Record<string, unknown>) {
    super(message, ErrorType.PAYMENT, 402, ErrorSeverity.HIGH, true, metadata)
  }
}

// Error handler class
class ErrorHandler {
  private isDevelopment = process.env.NODE_ENV === 'development'

  /**
   * Log error to console/monitoring service
   */
  private logError(error: Error | AppError): void {
    const timestamp = new Date().toISOString()
    const errorInfo = {
      timestamp,
      message: error.message,
      type: error instanceof AppError ? error.type : 'UNKNOWN',
      severity: error instanceof AppError ? error.severity : ErrorSeverity.HIGH,
      stack: this.isDevelopment ? error.stack : undefined,
      metadata: error instanceof AppError ? error.metadata : undefined
    }

    // Log based on severity
    if (error instanceof AppError) {
      switch (error.severity) {
        case ErrorSeverity.CRITICAL:
        case ErrorSeverity.HIGH:
          console.error('🔴 Critical Error:', errorInfo)
          // TODO: Send to monitoring service (Sentry, etc.)
          break
        case ErrorSeverity.MEDIUM:
          console.warn('🟡 Warning:', errorInfo)
          break
        case ErrorSeverity.LOW:
          console.info('🔵 Info:', errorInfo)
          break
      }
    } else {
      console.error('🔴 Unhandled Error:', errorInfo)
    }
  }

  /**
   * Handle error and return appropriate response
   */
  handle(error: Error | AppError): NextResponse {
    this.logError(error)

    // Handle known operational errors
    if (error instanceof AppError && error.isOperational) {
      return NextResponse.json(
        {
          error: {
            type: error.type,
            message: error.message,
            ...(this.isDevelopment && { stack: error.stack }),
            ...(error.metadata && { details: error.metadata })
          }
        },
        { status: error.statusCode }
      )
    }

    // Handle Supabase errors
    if (error && typeof error === 'object' && 'code' in error) {
      const supabaseError = error as any
      if (supabaseError.code === '23505') {
        return NextResponse.json(
          { error: { type: ErrorType.CONFLICT, message: 'Resource already exists' } },
          { status: 409 }
        )
      }
      if (supabaseError.code === 'PGRST116') {
        return NextResponse.json(
          { error: { type: ErrorType.NOT_FOUND, message: 'Resource not found' } },
          { status: 404 }
        )
      }
    }

    // Handle Stripe errors
    if (error && typeof error === 'object' && 'type' in error) {
      const stripeError = error as any
      if (stripeError.type === 'StripeCardError') {
        return NextResponse.json(
          { error: { type: ErrorType.PAYMENT, message: stripeError.message } },
          { status: 402 }
        )
      }
    }

    // Handle unknown errors
    const message = this.isDevelopment
      ? error.message
      : 'An unexpected error occurred'

    return NextResponse.json(
      {
        error: {
          type: ErrorType.INTERNAL,
          message,
          ...(this.isDevelopment && { stack: error.stack })
        }
      },
      { status: 500 }
    )
  }

  /**
   * Async error wrapper for route handlers
   */
  wrap<T extends any[], R>(
    fn: (...args: T) => Promise<R>
  ): (...args: T) => Promise<R | NextResponse> {
    return async (...args: T) => {
      try {
        return await fn(...args)
      } catch (error) {
        return this.handle(error as Error)
      }
    }
  }

  /**
   * Try-catch helper with error handling
   */
  async try<T>(
    operation: () => Promise<T>,
    errorMessage?: string
  ): Promise<[T, null] | [null, AppError]> {
    try {
      const result = await operation()
      return [result, null]
    } catch (error) {
      const appError = error instanceof AppError
        ? error
        : new AppError(errorMessage || (error as Error).message)

      this.logError(appError)
      return [null, appError]
    }
  }
}

// Create singleton instance
export const errorHandler = new ErrorHandler()

// Export convenience wrapper
export function withErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<R>
): (...args: T) => Promise<R | NextResponse> {
  return errorHandler.wrap(handler)
}