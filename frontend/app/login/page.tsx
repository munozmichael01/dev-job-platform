'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Loader2, Eye, EyeOff, Zap, ChartLine, Users } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const { login } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!email || !password) {
      setError('Por favor ingresa email y contraseña')
      return
    }

    setIsLoading(true)
    setError('')

    try {
      console.log('🔑 Frontend Login: Iniciando login...')
      console.log('📧 Frontend Login: Email:', email)
      
      // Llamar directamente al backend
      const response = await fetch('http://localhost:3002/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()
      console.log('📊 Frontend Login: Response:', data.success)

      if (!data.success) {
        throw new Error(data.error || 'Error en autenticación')
      }

      console.log('✅ Frontend Login: Login exitoso')
      console.log('👤 Frontend Login: Usuario:', data.user.email, data.user.role)
      
      // Usar la función login del AuthContext
      login(data.user, data.token)
      
      console.log('🏠 Frontend Login: Redirigiendo al dashboard...')
      
      // Redirigir al dashboard
      router.push('/')
      
    } catch (error: any) {
      console.error('❌ Frontend Login: Error:', error.message)
      setError(error.message || 'Error en autenticación')
    } finally {
      setIsLoading(false)
    }
  }

  // Quick login buttons para testing
  const quickLogin = (userEmail: string, userPassword: string) => {
    setEmail(userEmail)
    setPassword(userPassword)
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg flex items-center justify-center mr-3">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                Job<span className="text-blue-600">Platform</span>
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Login Content */}
      <main className="min-h-[calc(100vh-80px)] bg-gradient-to-br from-blue-50 via-white to-indigo-50">
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            {/* Login Card */}
            <div className="bg-white rounded-2xl shadow-xl p-8">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg flex items-center justify-center mb-6">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold text-gray-900">
                  Iniciar Sesión
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Accede a tu cuenta de Job<span className="font-bold text-blue-600">Platform</span>
                </p>
              </div>

              <div className="mt-8 space-y-6">
                {/* Quick Login Buttons para Testing */}
                <div className="space-y-3">
                  <Label className="text-sm font-medium text-gray-600">🧪 Usuarios de prueba (hacer clic para auto-completar):</Label>
                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => quickLogin('juan@miempresa.com', 'password123')}
                      className="text-left px-3 py-2 text-xs bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                    >
                      <div className="font-medium text-green-800">👑 Juan Pérez (Propietario)</div>
                      <div className="text-green-600">Ve sus 9 campañas • juan@miempresa.com</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => quickLogin('michael.munoz@turijobs.com', 'Turijobs-2021')}
                      className="text-left px-3 py-2 text-xs bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                    >
                      <div className="font-medium text-blue-800">👤 Michael Munoz (Usuario regular)</div>
                      <div className="text-blue-600">Ve datos vacíos • michael.munoz@turijobs.com</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => quickLogin('superadmin@jobplatform.com', 'admin123')}
                      className="text-left px-3 py-2 text-xs bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                    >
                      <div className="font-medium text-purple-800">🌍 Super Admin (Global)</div>
                      <div className="text-purple-600">Ve todos los datos • superadmin@jobplatform.com</div>
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">o iniciar sesión manualmente</span>
                  </div>
                </div>

                {/* Login Form */}
                <form className="space-y-4" onSubmit={handleSubmit}>
                  {/* Email Field */}
                  <div>
                    <Label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full"
                      placeholder="tu@email.com"
                      disabled={isLoading}
                    />
                  </div>

                  {/* Password Field */}
                  <div>
                    <Label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                      Contraseña
                    </Label>
                    <div className="relative">
                      <Input
                        id="password"
                        name="password"
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pr-10"
                        placeholder="Tu contraseña"
                        disabled={isLoading}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        disabled={isLoading}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Error Message */}
                  {error && (
                    <Alert variant="destructive">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  )}

                  {/* Submit Button */}
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-6 rounded-lg font-medium transition-colors"
                  >
                    {isLoading ? (
                      <div className="flex items-center justify-center">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Iniciando sesión...
                      </div>
                    ) : (
                      'Iniciar Sesión'
                    )}
                  </Button>
                </form>

                {/* Benefits */}
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-300" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-white text-gray-500">¿Por qué elegir JobPlatform?</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <ChartLine className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                    <span>Optimización automática de CPA y ROI</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="h-5 w-5 text-blue-500 mr-3 flex-shrink-0" />
                    <span>Distribución inteligente en 4+ canales</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Zap className="h-5 w-5 text-purple-500 mr-3 flex-shrink-0" />
                    <span>Setup en menos de 5 minutos</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="text-center">
              <p className="text-sm text-gray-600">
                Sistema de login interno • Sin problemas de hydration
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}