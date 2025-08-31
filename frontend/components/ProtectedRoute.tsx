'use client'

import { useEffect, useCallback, useRef } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { PageLoadingSpinner } from '@/components/ui/loading-spinner'
import { useAuthSync } from '@/lib/auth-sync'
import { logger } from '@/lib/logger'
import { useToast } from '@/hooks/use-toast'

interface ProtectedRouteProps {
  children: React.ReactNode
}

// Rutas que no requieren autenticación
const publicRoutes = ['/login']

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, user, isLoading, refreshAuth } = useAuth()
  const pathname = usePathname()
  const router = useRouter()
  const { toast } = useToast()

  // Use refs to store current values and avoid dependency changes
  const pathnameRef = useRef(pathname)
  const routerRef = useRef(router)
  
  // Update refs on each render
  pathnameRef.current = pathname
  routerRef.current = router

  // Stable callback that won't trigger hook reordering
  const handleAuthSync = useCallback((event: any) => {
    logger.debug('ProtectedRoute: Auth sync event received', { event })
    
    const currentPathname = pathnameRef.current
    const currentRouter = routerRef.current
    
    switch (event.type) {
      case 'LOGOUT':
      case 'SESSION_EXPIRED':
        // Force redirect to login when logout/session expired event is received
        if (!publicRoutes.includes(currentPathname)) {
          logger.info('ProtectedRoute: Redirecting to login due to auth event', { eventType: event.type })
          const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:3000'
          window.location.href = `${landingUrl}/login`
        }
        break
        
      case 'LOGIN':
        // Refresh the page if we're on login page and user just logged in
        if (publicRoutes.includes(currentPathname)) {
          logger.info('ProtectedRoute: User logged in, redirecting to dashboard')
          currentRouter.push('/')
        }
        break
    }
  }, []) // Empty dependencies array - callback is now stable

  useAuthSync(handleAuthSync)

  // Log route protection status
  useEffect(() => {
    logger.debug('ProtectedRoute: Route check', {
      pathname,
      isLoading,
      isAuthenticated,
      hasUser: !!user,
      isPublicRoute: publicRoutes.includes(pathname)
    })
  }, [pathname, isLoading, isAuthenticated, user])

  // Check authentication on route changes
  useEffect(() => {
    // Skip check for public routes
    if (publicRoutes.includes(pathname)) {
      return
    }

    // Only check when loading is complete
    if (!isLoading && !isAuthenticated) {
      logger.warn('ProtectedRoute: User not authenticated, redirecting to login', { pathname })
      
      toast({
        title: "Acceso denegado",
        description: "Debes iniciar sesión para acceder a esta página",
        variant: "destructive",
      })
      
      const landingUrl = process.env.NEXT_PUBLIC_LANDING_URL || 'http://localhost:3000'
      // Include return URL for redirect after login
      const returnUrl = encodeURIComponent(window.location.href)
      window.location.href = `${landingUrl}/login?returnUrl=${returnUrl}`
    }
  }, [isLoading, isAuthenticated, pathname, toast])

  // Periodically check if session is still valid
  useEffect(() => {
    if (!isAuthenticated || publicRoutes.includes(pathname)) {
      return
    }

    // Check auth state every 5 minutes
    const interval = setInterval(() => {
      logger.debug('ProtectedRoute: Periodic auth check')
      refreshAuth().catch(error => {
        logger.error('ProtectedRoute: Failed to refresh auth', error as Error)
      })
    }, 5 * 60 * 1000)

    return () => clearInterval(interval)
  }, [isAuthenticated, pathname, refreshAuth])

  // IMPORTANT: All hooks must be called before any conditional returns
  // Now we can handle conditional rendering

  // Si la ruta es pública, mostrar sin sidebar
  if (publicRoutes.includes(pathname)) {
    console.log('🛡️ ProtectedRoute: Ruta pública, mostrando sin protección')
    return (
      <div className="w-full">
        {children}
      </div>
    )
  }

  // Show loading while checking auth
  if (isLoading) {
    return <PageLoadingSpinner />
  }

  // After loading, if not authenticated and not on public route, show loading until redirect
  if (!isAuthenticated && !publicRoutes.includes(pathname)) {
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