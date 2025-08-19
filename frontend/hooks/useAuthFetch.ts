'use client'

import { useAuth } from '@/contexts/AuthContext'

export const useAuthFetch = () => {
  const { token, logout } = useAuth()

  const authFetch = async (url: string, options: RequestInit = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    }

    // Agregar token si existe
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    const response = await fetch(url, {
      ...options,
      headers,
    })

    // Si el token expiró, hacer logout
    if (response.status === 401) {
      console.warn('Token expirado, haciendo logout...')
      logout()
      throw new Error('Token expirado')
    }

    return response
  }

  return { authFetch }
}