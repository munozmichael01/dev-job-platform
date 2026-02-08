"use client"

import { useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      // No autenticado, redirigir a landing login
      window.location.href = 'http://localhost:3000/login'
    }
  }, [user, isLoading])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Cargando...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null // Redirigiendo...
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-3xl font-bold mb-4">✅ Dashboard</h1>
          <p className="text-gray-600 mb-6">Autenticado con Supabase</p>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <p className="text-green-800 font-semibold">Usuario:</p>
            <p className="text-green-600">{user.email}</p>
            <p className="text-green-600 text-sm">ID: {user.id}</p>
          </div>

          <div className="space-y-4">
            <p className="text-gray-700">
              <strong>🎉 ¡Migración exitosa!</strong>
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
              <li>✅ Login desde landing (puerto 3000)</li>
              <li>✅ Autenticación con Supabase</li>
              <li>✅ Sesión activa en frontend (puerto 3006)</li>
              <li>✅ Base de datos PostgreSQL en cloud</li>
            </ul>

            <div className="mt-8 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800 font-semibold mb-2">Próximos pasos:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-700">
                <li>Conectar dashboard real con queries Supabase</li>
                <li>Configurar Row Level Security (RLS)</li>
                <li>Deploy a Vercel</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
