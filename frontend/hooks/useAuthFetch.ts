'use client'

import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/use-toast'
import { AuthError, APIError, NetworkError, getErrorMessage, logError } from '@/lib/errors'
import { trackApiCall, logger } from '@/lib/logger'
import { authSyncManager } from '@/lib/auth-sync'

interface AuthFetchOptions extends RequestInit {
  skipAuthCheck?: boolean
  maxRetries?: number
  retryDelay?: number
}

export const useAuthFetch = () => {
  const { token, logout, isAuthenticated } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const authFetch = async (url: string, options: AuthFetchOptions = {}) => {
    const {
      skipAuthCheck = false,
      maxRetries = 2,
      retryDelay = 1000,
      ...fetchOptions
    } = options

    // Check authentication before making request
    if (!skipAuthCheck && !isAuthenticated) {
      toast({
        title: "No autenticado",
        description: "Por favor, inicia sesión para continuar",
        variant: "destructive",
      })
      router.push('/login')
      throw new AuthError('Usuario no autenticado')
    }

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    }

    // Add token if exists
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    let lastError: Error | null = null
    const startTime = performance.now()
    
    // Retry logic
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        logger.debug(`API Request: ${fetchOptions.method || 'GET'} ${url}`, {
          attempt: attempt + 1,
          headers: headers
        })

        const response = await fetch(url, {
          ...fetchOptions,
          headers,
        })

        const duration = performance.now() - startTime

        // Handle authentication errors
        if (response.status === 401) {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = errorData.message || 'Sesión expirada'
          
          const authError = new AuthError(errorMessage)
          trackApiCall(fetchOptions.method || 'GET', url, duration, response.status, authError)
          logError(authError, { url, status: 401 })
          
          // Broadcast session expired event to sync all tabs and components
          authSyncManager.broadcast({ type: 'SESSION_EXPIRED' })
          
          // Show toast only once (will be handled by AuthContext)
          if (!window.__401_TOAST_SHOWN__) {
            window.__401_TOAST_SHOWN__ = true
            toast({
              title: "Sesión expirada",
              description: "Por favor, inicia sesión nuevamente",
              variant: "destructive",
            })
            
            // Reset flag after a delay
            setTimeout(() => {
              window.__401_TOAST_SHOWN__ = false
            }, 5000)
          }
          
          // Don't call logout here - let AuthContext handle it via the broadcast event
          // This prevents multiple logout calls
          
          throw authError
        }

        // Handle other HTTP errors
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          const errorMessage = errorData.message || `Error HTTP ${response.status}`
          
          const apiError = new APIError(errorMessage, response.status, errorData)
          trackApiCall(fetchOptions.method || 'GET', url, duration, response.status, apiError)
          
          // Don't retry client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            throw apiError
          }
          
          // For server errors (5xx), throw to trigger retry
          throw apiError
        }

        // Success - track and return response
        trackApiCall(fetchOptions.method || 'GET', url, duration, response.status)
        return response
        
      } catch (error) {
        lastError = error as Error
        
        // Don't retry on auth errors or client errors
        if (error instanceof AuthError || 
            (error instanceof APIError && error.statusCode >= 400 && error.statusCode < 500)) {
          throw error
        }
        
        // Network or server error - check if we should retry
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt) // Exponential backoff
          
          logger.warn(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`, {
            url,
            method: fetchOptions.method || 'GET',
            error: error instanceof Error ? error.message : String(error)
          })
          
          toast({
            title: "Reintentando conexión...",
            description: `Intento ${attempt + 1} de ${maxRetries}`,
          })
          
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        // Max retries reached
        if (error instanceof APIError) {
          throw error
        }
        
        // Network error
        throw new NetworkError('Error de conexión al servidor', error)
      }
    }
    
    // This should never happen, but TypeScript needs it
    throw lastError || new Error('Error desconocido')
  }

  // Convenience method for JSON responses
  const authFetchJSON = async <T = any>(url: string, options: AuthFetchOptions = {}): Promise<T> => {
    try {
      const response = await authFetch(url, options)
      const data = await response.json()
      return data as T
    } catch (error) {
      // Log error with context
      logError(error, { 
        url, 
        method: options.method || 'GET',
        context: 'authFetchJSON' 
      })
      
      // Show user-friendly error message
      const message = getErrorMessage(error)
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      })
      
      throw error
    }
  }

  return { authFetch, authFetchJSON }
}