// Custom error types for better error handling

export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message)
    this.name = 'AuthError'
  }
}

export class APIError extends Error {
  constructor(
    message: string, 
    public statusCode: number, 
    public details?: any
  ) {
    super(message)
    this.name = 'APIError'
  }
}

export class NetworkError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message)
    this.name = 'NetworkError'
  }
}

export class ValidationError extends Error {
  constructor(message: string, public fields?: Record<string, string>) {
    super(message)
    this.name = 'ValidationError'
  }
}

// Helper function to determine error type and provide user-friendly message
export function getErrorMessage(error: unknown): string {
  if (error instanceof AuthError) {
    switch (error.statusCode) {
      case 401:
        return 'Tu sesión ha expirado. Por favor, inicia sesión nuevamente.'
      case 403:
        return 'No tienes permisos para realizar esta acción.'
      default:
        return error.message || 'Error de autenticación'
    }
  }

  if (error instanceof APIError) {
    switch (error.statusCode) {
      case 400:
        return 'Los datos enviados no son válidos. Por favor, verifica la información.'
      case 404:
        return 'El recurso solicitado no fue encontrado.'
      case 409:
        return 'Conflicto al procesar la solicitud. El recurso ya existe.'
      case 422:
        return 'Los datos no pueden ser procesados. Verifica el formato.'
      case 500:
        return 'Error interno del servidor. Por favor, intenta más tarde.'
      case 503:
        return 'El servicio no está disponible temporalmente. Por favor, intenta más tarde.'
      default:
        return error.message || `Error del servidor (${error.statusCode})`
    }
  }

  if (error instanceof NetworkError) {
    return 'Error de conexión. Por favor, verifica tu conexión a internet.'
  }

  if (error instanceof ValidationError) {
    return error.message || 'Por favor, corrige los errores en el formulario.'
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Ha ocurrido un error inesperado. Por favor, intenta nuevamente.'
}

import { logger } from './logger'

// Helper function to log errors in production
export function logError(error: unknown, context?: Record<string, any>) {
  const errorObj = error instanceof Error ? error : new Error(String(error))
  
  // Use structured logger
  logger.error(
    errorObj.message,
    errorObj,
    context
  )

  // Track specific error types
  if (error instanceof AuthError) {
    logger.trackEvent('auth_error', {
      statusCode: error.statusCode,
      ...context
    })
  } else if (error instanceof APIError) {
    logger.trackEvent('api_error', {
      statusCode: error.statusCode,
      details: error.details,
      ...context
    })
  } else if (error instanceof NetworkError) {
    logger.trackEvent('network_error', {
      originalError: error.originalError?.message,
      ...context
    })
  } else if (error instanceof ValidationError) {
    logger.trackEvent('validation_error', {
      fields: error.fields,
      ...context
    })
  }
}
