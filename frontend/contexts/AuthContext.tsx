'use client'

import React, { createContext, useContext, useState, useEffect, useLayoutEffect, useCallback } from 'react'
import { AuthError, logError } from '@/lib/errors'
import { useToast } from '@/hooks/use-toast'
import { authSyncManager, useAuthSync, type AuthEvent } from '@/lib/auth-sync'
import { logger } from '@/lib/logger'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  company: string
  role: string
}

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  error: string | null
  lastActivity: number | null
}

interface AuthContextType extends AuthState {
  login: (userData: User, token: string) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
  clearError: () => void
  isAuthenticated: boolean
  fetchWithAuth: (url: string, options?: RequestInit) => Promise<Response>
  updateLastActivity: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Session timeout in milliseconds (30 minutes)
const SESSION_TIMEOUT = 30 * 60 * 1000

// Storage keys
const STORAGE_KEYS = {
  TOKEN: 'auth_token',
  USER: 'auth_user',
  LAST_ACTIVITY: 'auth_last_activity'
} as const

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { toast } = useToast()
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    token: null,
    isLoading: true,
    error: null,
    lastActivity: null
  })

  // Handle auth events from other tabs/components
  const handleAuthEvent = useCallback((event: AuthEvent) => {
    logger.info('Received auth event', { eventType: event.type })

    switch (event.type) {
      case 'LOGIN':
        if (event.payload) {
          updateAuthState({
            user: event.payload.user,
            token: event.payload.token,
            lastActivity: Date.now(),
            isLoading: false,
            error: null
          })
          saveAuthStorage(event.payload.user, event.payload.token)
        }
        break

      case 'LOGOUT':
      case 'SESSION_EXPIRED':
        clearAuthStorage()
        updateAuthState({
          user: null,
          token: null,
          lastActivity: null,
          isLoading: false,
          error: event.type === 'SESSION_EXPIRED' ? 'Sesión expirada' : null
        })
        
        if (event.type === 'SESSION_EXPIRED') {
          toast({
            title: "Sesión expirada",
            description: "Tu sesión ha expirado. Por favor, inicia sesión nuevamente.",
            variant: "destructive",
          })
        }
        break

      case 'TOKEN_REFRESHED':
        if (event.payload && authState.user) {
          updateAuthState({
            token: event.payload.token,
            lastActivity: Date.now()
          })
          localStorage.setItem(STORAGE_KEYS.TOKEN, event.payload.token)
        }
        break
    }
  }, [authState.user, toast])

  // Setup auth sync
  const { broadcastAuthEvent } = useAuthSync(handleAuthEvent)

  // Helper to update auth state
  const updateAuthState = useCallback((updates: Partial<AuthState>) => {
    setAuthState(prev => ({ ...prev, ...updates }))
  }, [])

  // Helper to clear auth data from storage
  const clearAuthStorage = useCallback(() => {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key)
      })
    } catch (error) {
      logError(error, { context: 'clearAuthStorage' })
    }
  }, [])

  // Helper to save auth data to storage
  const saveAuthStorage = useCallback((user: User, token: string) => {
    try {
      localStorage.setItem(STORAGE_KEYS.TOKEN, token)
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user))
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, Date.now().toString())
    } catch (error) {
      logError(error, { context: 'saveAuthStorage' })
      throw new Error('Error al guardar la sesión')
    }
  }, [])

  // Update last activity timestamp
  const updateLastActivity = useCallback(() => {
    const now = Date.now()
    updateAuthState({ lastActivity: now })
    try {
      localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, now.toString())
    } catch (error) {
      logError(error, { context: 'updateLastActivity' })
    }
  }, [updateAuthState])

  // Check for session timeout
  const checkSessionTimeout = useCallback(() => {
    const lastActivity = authState.lastActivity
    if (lastActivity && Date.now() - lastActivity > SESSION_TIMEOUT) {
      // Broadcast session expired to all tabs
      broadcastAuthEvent({ type: 'SESSION_EXPIRED' })
      
      toast({
        title: "Sesión expirada",
        description: "Tu sesión ha expirado por inactividad. Por favor, inicia sesión nuevamente.",
        variant: "destructive",
      })
      clearAuthStorage()
      updateAuthState({ 
        user: null, 
        token: null, 
        error: 'Sesión expirada',
        lastActivity: null 
      })
      return true
    }
    return false
  }, [authState.lastActivity, clearAuthStorage, updateAuthState, toast, broadcastAuthEvent])

  // Initialize auth state from storage
  useLayoutEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    const initializeAuth = async () => {
      try {
        console.log('🔍 Platform Frontend: Inicializando autenticación...')
        
        const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN)
        const storedUser = localStorage.getItem(STORAGE_KEYS.USER)
        const storedLastActivity = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY)
        
        if (storedToken && storedUser) {
          try {
            const userData = JSON.parse(storedUser)
            const lastActivity = storedLastActivity ? parseInt(storedLastActivity) : Date.now()
            
            // Validate user data
            if (!userData.id || !userData.email) {
              throw new Error('Datos de usuario incompletos')
            }
            
            // Check if session has expired
            if (Date.now() - lastActivity > SESSION_TIMEOUT) {
              console.log('⏰ Platform Frontend: Sesión expirada')
              clearAuthStorage()
              updateAuthState({ isLoading: false, error: 'Sesión expirada' })
              return
            }
            
            console.log('✅ Platform Frontend: Sesión restaurada exitosamente')
            updateAuthState({
              user: userData,
              token: storedToken,
              lastActivity,
              isLoading: false,
              error: null
            })
          } catch (error) {
            console.error('❌ Platform Frontend: Error restaurando sesión:', error)
            logError(error, { context: 'initializeAuth' })
            clearAuthStorage()
            updateAuthState({ isLoading: false, error: 'Error al restaurar sesión' })
          }
        } else {
          console.log('ℹ️ Platform Frontend: No hay sesión guardada')
          updateAuthState({ isLoading: false })
        }
      } catch (error) {
        console.error('❌ Platform Frontend: Error en inicialización:', error)
        logError(error, { context: 'initializeAuth' })
        updateAuthState({ isLoading: false, error: 'Error al inicializar' })
      }
    }

    // Add a small delay to ensure localStorage is ready
    const timer = setTimeout(initializeAuth, 100)
    return () => clearTimeout(timer)
  }, [clearAuthStorage, updateAuthState])

  // Listen for storage changes from other tabs/windows
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorageChange = (e: StorageEvent) => {
      console.log('🔄 Platform Frontend: Detectado cambio en localStorage:', e.key)
      
      if (e.key === STORAGE_KEYS.TOKEN || e.key === STORAGE_KEYS.USER) {
        const token = localStorage.getItem(STORAGE_KEYS.TOKEN)
        const userData = localStorage.getItem(STORAGE_KEYS.USER)
        const lastActivity = localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY)
        
        if (token && userData) {
          try {
            const user = JSON.parse(userData)
            console.log('🔄 Platform Frontend: Actualizando sesión desde storage event')
            updateAuthState({
              user,
              token,
              lastActivity: lastActivity ? parseInt(lastActivity) : Date.now(),
              isLoading: false,
              error: null
            })
          } catch (error) {
            console.error('❌ Platform Frontend: Error en storage event:', error)
            logError(error, { context: 'handleStorageChange' })
          }
        } else {
          console.log('🔄 Platform Frontend: Limpiando sesión desde storage event')
          updateAuthState({
            user: null,
            token: null,
            lastActivity: null,
            error: null
          })
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [updateAuthState])

  // Login function
  const login = useCallback(async (userData: User, authToken: string): Promise<void> => {
    try {
      console.log('🔑 Platform Frontend: Función login llamada')
      
      // Validate inputs
      if (!userData || !authToken) {
        throw new Error('Datos de login inválidos')
      }

      // Save to storage
      saveAuthStorage(userData, authToken)
      
      // Update state
      updateAuthState({
        user: userData,
        token: authToken,
        lastActivity: Date.now(),
        isLoading: false,
        error: null
      })
      
      // Broadcast login event to other tabs/components
      broadcastAuthEvent({
        type: 'LOGIN',
        payload: { user: userData, token: authToken }
      })
      
      console.log('✅ Platform Frontend: Login completado exitosamente')
      
      toast({
        title: "Bienvenido",
        description: `Hola ${userData.firstName}, has iniciado sesión correctamente`,
      })
    } catch (error) {
      console.error('❌ Platform Frontend: Error en login:', error)
      logError(error, { context: 'login', userData: userData?.email })
      
      updateAuthState({
        error: error instanceof Error ? error.message : 'Error al iniciar sesión'
      })
      
      throw error
    }
  }, [saveAuthStorage, updateAuthState, toast, broadcastAuthEvent])

  // Fetch with auth function
  const fetchWithAuth = useCallback(async (url: string, options: RequestInit = {}): Promise<Response> => {
    // Check session timeout before making request
    if (checkSessionTimeout()) {
      throw new AuthError('Sesión expirada')
    }

    // Update last activity
    updateLastActivity()

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    // Add auth token if exists
    if (authState.token) {
      headers['Authorization'] = `Bearer ${authState.token}`
    }

    console.log('📡 Haciendo petición con auth:', url)
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      })

              // Handle 401 errors
        if (response.status === 401) {
          console.warn('🚫 Platform Frontend: Token inválido o expirado')
          
          // Broadcast session expired to sync all tabs
          broadcastAuthEvent({ type: 'SESSION_EXPIRED' })
          
          updateAuthState({ error: 'Sesión inválida' })
          throw new AuthError('Sesión inválida', 401)
        }

      return response
    } catch (error) {
      logError(error, { context: 'fetchWithAuth', url })
      throw error
    }
  }, [authState.token, checkSessionTimeout, updateLastActivity, updateAuthState, broadcastAuthEvent])

  // Logout function
  const logout = useCallback(async (): Promise<void> => {
    try {
      console.log('🚪 Platform Frontend: Iniciando logout...')
      
      // Broadcast logout event immediately to sync all tabs
      broadcastAuthEvent({ type: 'LOGOUT' })
      
      // Call backend logout endpoint if token exists
      if (authState.token) {
        try {
          const response = await fetch('http://localhost:3002/api/auth/logout', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${authState.token}`,
              'Content-Type': 'application/json'
            }
          })
          
          if (!response.ok) {
            console.warn('⚠️ Platform Frontend: Error en logout del backend:', response.status)
          }
        } catch (error) {
          console.error('❌ Platform Frontend: Error llamando endpoint de logout:', error)
          logError(error, { context: 'logout-endpoint' })
        }
      }
    } finally {
      // Clear local state regardless of backend result
      clearAuthStorage()
      updateAuthState({
        user: null,
        token: null,
        lastActivity: null,
        isLoading: false,
        error: null
      })
      
      console.log('✅ Platform Frontend: Logout completado')
      
      // Redirect to landing login
      const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:3000'
      window.location.href = `${landingUrl}/login`
    }
  }, [authState.token, clearAuthStorage, updateAuthState, broadcastAuthEvent])

  // Refresh auth function
  const refreshAuth = useCallback(async (): Promise<void> => {
    try {
      console.log('🔄 Platform Frontend: Refrescando autenticación...')
      
      const storedToken = localStorage.getItem(STORAGE_KEYS.TOKEN)
      const storedUser = localStorage.getItem(STORAGE_KEYS.USER)
      
      if (storedToken && storedUser) {
        const userData = JSON.parse(storedUser)
        updateAuthState({
          user: userData,
          token: storedToken,
          lastActivity: Date.now(),
          error: null
        })
        console.log('✅ Platform Frontend: Autenticación refrescada')
      } else {
        throw new Error('No hay sesión para refrescar')
      }
    } catch (error) {
      console.error('❌ Platform Frontend: Error refrescando auth:', error)
      logError(error, { context: 'refreshAuth' })
      throw error
    }
  }, [updateAuthState])

  // Clear error function
  const clearError = useCallback(() => {
    updateAuthState({ error: null })
  }, [updateAuthState])

  // Check activity on user interactions
  useEffect(() => {
    if (!authState.user) return

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart']
    const handleActivity = () => {
      if (!checkSessionTimeout()) {
        updateLastActivity()
      }
    }

    events.forEach(event => {
      window.addEventListener(event, handleActivity)
    })

    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity)
      })
    }
  }, [authState.user, checkSessionTimeout, updateLastActivity])

  const value: AuthContextType = {
    ...authState,
    login,
    logout,
    refreshAuth,
    clearError,
    isAuthenticated: !!authState.user && !!authState.token,
    fetchWithAuth,
    updateLastActivity
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}