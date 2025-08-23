// Auth synchronization across tabs and components

import { logger } from './logger'

export type AuthEvent = 
  | { type: 'LOGIN'; payload: { user: any; token: string } }
  | { type: 'LOGOUT' }
  | { type: 'SESSION_EXPIRED' }
  | { type: 'TOKEN_REFRESHED'; payload: { token: string } }
  | { type: 'AUTH_CHECK' }
  | { type: 'AUTH_STATE'; payload: { isAuthenticated: boolean; user: any; token: string | null } }

type AuthEventListener = (event: AuthEvent) => void

class AuthSyncManager {
  private static instance: AuthSyncManager
  private channel: BroadcastChannel | null = null
  private listeners: Set<AuthEventListener> = new Set()
  private isLeader: boolean = false
  private leaderElectionTimeout: NodeJS.Timeout | null = null


  private constructor() {
    this.initialize()
  }

  static getInstance(): AuthSyncManager {
    if (!AuthSyncManager.instance) {
      AuthSyncManager.instance = new AuthSyncManager()
    }
    return AuthSyncManager.instance
  }

  private initialize(): void {
    if (typeof window === 'undefined') return

    try {
      // Create broadcast channel for cross-tab communication
      this.channel = new BroadcastChannel('auth_sync')
      
      // Listen for messages from other tabs
      this.channel.addEventListener('message', (event) => {
        this.handleChannelMessage(event.data)
      })

      // Start leader election
      this.startLeaderElection()

      // Setup visibility change handler
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          // Removed checkAuthState call - no longer needed
        }
      })

      // Setup online/offline handlers
      window.addEventListener('online', () => {
        logger.info('Network online')
        // Removed checkAuthState call - no longer needed
      })

      logger.info('AuthSyncManager initialized')
    } catch (error) {
      logger.warn('BroadcastChannel not supported, falling back to localStorage events', { error })
      this.setupStorageFallback()
    }
  }

  private setupStorageFallback(): void {
    // Fallback for browsers that don't support BroadcastChannel
    window.addEventListener('storage', (e) => {
      if (e.key === 'auth_sync_event') {
        const data = e.newValue ? JSON.parse(e.newValue) : null
        if (data) {
          this.handleChannelMessage(data.event)
          // Clean up after reading
          localStorage.removeItem('auth_sync_event')
        }
      }
    })
  }

  private startLeaderElection(): void {
    // Simple leader election - first tab becomes leader
    this.broadcast({ type: 'AUTH_CHECK' })
    
    this.leaderElectionTimeout = setTimeout(() => {
      if (!this.isLeader) {
        this.becomeLeader()
      }
    }, 100)
  }

  private becomeLeader(): void {
    this.isLeader = true
    logger.info('This tab is now the auth sync leader')
  }

  private handleChannelMessage(event: AuthEvent): void {
    logger.debug('Received auth sync event', { event })

    switch (event.type) {
      case 'AUTH_CHECK':
        // Another tab is checking who's leader
        if (this.isLeader) {
          // Respond with current auth state
          const authData = this.getCurrentAuthState()
          if (authData) {
            this.broadcast({
              type: 'AUTH_STATE',
              payload: authData
            })
          }
        }
        break

      case 'AUTH_STATE':
        // Leader responded with auth state
        if (this.leaderElectionTimeout) {
          clearTimeout(this.leaderElectionTimeout)
          this.leaderElectionTimeout = null
        }
        break

      case 'LOGIN':
      case 'LOGOUT':
      case 'SESSION_EXPIRED':
      case 'TOKEN_REFRESHED':
        // Forward to local listeners
        this.notifyListeners(event)
        break
    }
  }

  private getCurrentAuthState(): { isAuthenticated: boolean; user: any; token: string | null } | null {
    try {
      const token = localStorage.getItem('auth_token')
      const userStr = localStorage.getItem('auth_user')
      
      if (token && userStr) {
        const user = JSON.parse(userStr)
        return { isAuthenticated: true, user, token }
      }
      
      return { isAuthenticated: false, user: null, token: null }
    } catch (error) {
      logger.error('Error getting current auth state', error as Error)
      return null
    }
  }



  // Public methods
  broadcast(event: AuthEvent): void {
    logger.debug('Broadcasting auth event', { event })

    if (this.channel && this.channel.name) {
      try {
        this.channel.postMessage(event)
      } catch (error) {
        logger.error('Error broadcasting via BroadcastChannel', error as Error)
      }
    }

    // Fallback to localStorage for browsers without BroadcastChannel
    if (!this.channel) {
      try {
        localStorage.setItem('auth_sync_event', JSON.stringify({
          event,
          timestamp: Date.now()
        }))
        // Trigger storage event manually for same tab
        window.dispatchEvent(new StorageEvent('storage', {
          key: 'auth_sync_event',
          newValue: JSON.stringify({ event, timestamp: Date.now() }),
          url: window.location.href
        }))
      } catch (error) {
        logger.error('Error broadcasting via localStorage', error as Error)
      }
    }

    // Also notify local listeners
    this.notifyListeners(event)
  }

  subscribe(listener: AuthEventListener): () => void {
    this.listeners.add(listener)
    
    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }

  private notifyListeners(event: AuthEvent): void {
    this.listeners.forEach(listener => {
      try {
        listener(event)
      } catch (error) {
        logger.error('Error in auth event listener', error as Error)
      }
    })
  }

  // Lifecycle methods
  destroy(): void {
    if (this.channel) {
      this.channel.close()
    }
    
    if (this.leaderElectionTimeout) {
      clearTimeout(this.leaderElectionTimeout)
    }
    

    
    this.listeners.clear()
  }
}

// Export singleton instance
export const authSyncManager = AuthSyncManager.getInstance()

// React hook for auth sync
import { useEffect, useCallback } from 'react'

export function useAuthSync(onAuthEvent?: (event: AuthEvent) => void) {
  useEffect(() => {
    if (!onAuthEvent) return

    const unsubscribe = authSyncManager.subscribe(onAuthEvent)
    return unsubscribe
  }, [onAuthEvent])

  const broadcastAuthEvent = useCallback((event: AuthEvent) => {
    authSyncManager.broadcast(event)
  }, [])

  return { broadcastAuthEvent }
}
