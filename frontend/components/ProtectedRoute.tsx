'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"

interface ProtectedRouteProps {
  children: React.ReactNode
}

// Rutas que no requieren autenticación
const publicRoutes = ['/login']

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading } = useAuth()
  const pathname = usePathname()

  console.log('🛡️ ProtectedRoute: Pathname:', pathname)
  console.log('🛡️ ProtectedRoute: isLoading:', isLoading)
  console.log('🛡️ ProtectedRoute: isAuthenticated:', isAuthenticated)
  console.log('🛡️ ProtectedRoute: user:', !!user)

  // Si la ruta es pública, mostrar sin sidebar
  if (publicRoutes.includes(pathname)) {
    console.log('🛡️ ProtectedRoute: Ruta pública, mostrando sin protección')
    return (
      <div className="w-full">
        {children}
      </div>
    )
  }

  useEffect(() => {
    console.log('🛡️ ProtectedRoute useEffect: isLoading =', isLoading, ', isAuthenticated =', isAuthenticated)
    
    // Solo verificar autenticación cuando la inicialización haya terminado
    if (!isLoading && !isAuthenticated && !publicRoutes.includes(pathname)) {
      console.log('🛡️ ProtectedRoute: Inicialización completa y usuario no autenticado, redirigiendo al login de la landing...')
      const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:3000'
      window.location.href = `${landingUrl}/login`
      return
    }
  }, [isLoading, isAuthenticated, pathname])

  // Mientras carga la inicialización, mostrar loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Inicializando autenticación...</p>
        </div>
      </div>
    )
  }

  // Después de la inicialización, si no está autenticado, mostrar loading hasta el redirect
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Redirigiendo al login...</p>
        </div>
      </div>
    )
  }

  // Si está autenticado, mostrar el contenido con sidebar
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-auto">{children}</main>
    </SidebarProvider>
  )
}