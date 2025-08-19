'use client'

import React, { createContext, useContext, useState, useEffect, useLayoutEffect } from 'react'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  company: string
  role: string
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (userData: User, token: string) => void
  logout: () => void
  isAuthenticated: boolean
  isLoading: boolean
  fetchWithAuth: (url: string, options?: any) => Promise<Response>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Usar useLayoutEffect para que se ejecute antes del render
  useLayoutEffect(() => {
    // Verificar que estamos en el cliente
    if (typeof window === 'undefined') {
      return
    }

    let retryCount = 0
    const maxRetries = 10 // Incrementar el número de reintentos
    let retryInterval: NodeJS.Timeout | null = null
    
    const checkAuth = (): boolean => {
      try {
        console.log(`🔍 Platform Frontend: Verificando auth en localStorage... (intento ${retryCount + 1}/${maxRetries})`)
        
        // Verificar que localStorage esté disponible
        if (!window.localStorage) {
          console.log('❌ Platform Frontend: localStorage no disponible')
          return false
        }
        
        const storedToken = window.localStorage.getItem('auth_token')
        const storedUser = window.localStorage.getItem('auth_user')
        
        console.log('🔑 Platform Frontend: Token encontrado:', !!storedToken)
        console.log('👤 Platform Frontend: Usuario encontrado:', !!storedUser)
        console.log('🔑 Platform Frontend: Token length:', storedToken?.length || 0)
        console.log('👤 Platform Frontend: User data length:', storedUser?.length || 0)
        
        if (storedToken && storedUser) {
          try {
            console.log('✅ Platform Frontend: Restaurando sesión...')
            const userData = JSON.parse(storedUser)
            
            // Validar que userData tiene los campos necesarios
            if (!userData.id || !userData.email) {
              throw new Error('Datos de usuario incompletos')
            }
            
            setToken(storedToken)
            setUser(userData)
            console.log('✅ Platform Frontend: Sesión restaurada exitosamente')
            console.log('👤 Platform Frontend: Usuario restaurado:', userData.email, userData.role)
            setIsLoading(false)
            return true
          } catch (error) {
            console.error('❌ Platform Frontend: Error parsing stored user data:', error)
            // Limpiar datos corruptos
            try {
              window.localStorage.removeItem('auth_token')
              window.localStorage.removeItem('auth_user')
            } catch (e) {
              console.error('❌ Error limpiando localStorage:', e)
            }
          }
        } else {
          console.log('❌ Platform Frontend: No hay sesión guardada')
        }
        
        return false
      } catch (error) {
        console.error('❌ Platform Frontend: Error en checkAuth:', error)
        return false
      }
    }
    
    // Intentar cargar inmediatamente
    if (checkAuth()) {
      return
    }
    
    // Si no encontró datos, intentar de nuevo después de un poco de tiempo
    // Esto ayuda cuando la landing page está escribiendo al localStorage
    retryInterval = setInterval(() => {
      retryCount++
      
      if (checkAuth() || retryCount >= maxRetries) {
        if (retryInterval) {
          clearInterval(retryInterval)
        }
        console.log('🏁 Platform Frontend: Inicialización completada')
        setIsLoading(false)
      }
    }, 300) // Incrementar intervalo a 300ms
    
    return () => {
      if (retryInterval) {
        clearInterval(retryInterval)
      }
    }
  }, [])

  // Escuchar cambios en localStorage desde otras pestañas/ventanas
  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleStorageChange = (e: StorageEvent) => {
      console.log('🔄 Platform Frontend: Detectado cambio en localStorage:', e.key)
      
      if (e.key === 'auth_token' || e.key === 'auth_user') {
        const token = window.localStorage.getItem('auth_token')
        const userData = window.localStorage.getItem('auth_user')
        
        if (token && userData) {
          try {
            const user = JSON.parse(userData)
            console.log('🔄 Platform Frontend: Actualizando sesión desde storage event')
            setToken(token)
            setUser(user)
            setIsLoading(false)
          } catch (error) {
            console.error('❌ Platform Frontend: Error en storage event:', error)
          }
        } else {
          console.log('🔄 Platform Frontend: Limpiando sesión desde storage event')
          setToken(null)
          setUser(null)
        }
      }
    }

    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const login = (userData: User, authToken: string) => {
    console.log('🔑 Platform Frontend: Función login llamada')
    console.log('👤 Platform Frontend: Usuario data:', userData)
    console.log('🔑 Platform Frontend: Token recibido:', !!authToken)
    
    setUser(userData)
    setToken(authToken)
    localStorage.setItem('auth_token', authToken)
    localStorage.setItem('auth_user', JSON.stringify(userData))
    
    console.log('✅ Platform Frontend: Login completado, datos guardados')
  }

  const fetchWithAuth = async (url: string, options: any = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }

    // Agregar token de autorización si existe
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
      console.log('🔐 Agregando Authorization header con token')
    }

    console.log('📡 Haciendo petición con auth:', url, { ...options, headers })
    
    return fetch(url, {
      ...options,
      headers,
    })
  }

  const logout = async () => {
    try {
      // Llamar al endpoint de logout del backend
      if (token) {
        await fetchWithAuth('http://localhost:3002/api/auth/logout', {
          method: 'POST'
        })
      }
    } catch (error) {
      console.error('Error during logout:', error)
    } finally {
      // Limpiar estado local independientemente del resultado del backend
      setUser(null)
      setToken(null)
      localStorage.removeItem('auth_token')
      localStorage.removeItem('auth_user')
      
      // Redirigir a página de login interna
      window.location.href = '/login'
    }
  }

  const value: AuthContextType = {
    user,
    token,
    login,
    logout,
    isAuthenticated: !!user && !!token,
    isLoading,
    fetchWithAuth
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}