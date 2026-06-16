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
      const apiUrl = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002').replace(/\/+$/, '')
      const response = await fetch(`${apiUrl}/api/auth/login`, {
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


  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="mr-3 flex h-9 w-9 items-center justify-center rounded-[11px] border-2 border-ds-ink bg-ds-accent text-white shadow-hard">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <h1 className="font-display text-2xl font-black tracking-[-0.05em] text-ds-ink">
                Talent<span className="text-ds-brand">OS</span>
              </h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Login Content */}
      <main className="ds-card-grid min-h-[calc(100vh-80px)] bg-background">
        <div className="flex items-center justify-center min-h-[calc(100vh-80px)] px-4 sm:px-6 lg:px-8">
          <div className="max-w-md w-full space-y-8">
            {/* Login Card */}
            <div className="rounded-[24px] border border-border bg-card p-8 shadow-pop">
              <div className="text-center">
                <div className="mx-auto mb-6 flex h-12 w-12 items-center justify-center rounded-[14px] border-2 border-ds-ink bg-ds-accent text-white shadow-hard">
                  <Zap className="h-6 w-6 text-white" />
                </div>
                <h2 className="font-display text-4xl font-black tracking-[-0.06em] text-ds-ink">
                  Bienvenido de vuelta
                </h2>
                <p className="mt-3 text-sm font-medium text-muted-foreground">
                  Accede a tu cuenta de <span className="font-bold text-ds-brand">TalentOS</span>
                </p>
              </div>

              <div className="mt-8 space-y-6">

                {/* Login Form */}
                <form className="space-y-4" onSubmit={handleSubmit}>
                  {/* Email Field */}
                  <div>
                    <Label htmlFor="email" className="mb-1 block text-sm font-bold text-foreground">
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
                    <Label htmlFor="password" className="mb-1 block text-sm font-bold text-foreground">
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
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-ds-brand"
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
                    className="w-full"
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
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-card px-2 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">¿Por qué elegir TalentOS?</span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center text-sm font-medium text-muted-foreground">
                    <ChartLine className="mr-3 h-5 w-5 flex-shrink-0 text-ds-brand" />
                    <span>Optimización de canales por objetivos y presupuesto</span>
                  </div>
                  <div className="flex items-center text-sm font-medium text-muted-foreground">
                    <Users className="mr-3 h-5 w-5 flex-shrink-0 text-ds-accent" />
                    <span>ATS y operaciones de talento en una sola base</span>
                  </div>
                  <div className="flex items-center text-sm font-medium text-muted-foreground">
                    <Zap className="mr-3 h-5 w-5 flex-shrink-0 text-ds-lime" />
                    <span>Automatización asistida por IA, humano al mando</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Additional Info */}
            <div className="text-center">
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                Sistema interno de operaciones de talento
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
