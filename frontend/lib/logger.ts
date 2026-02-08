// Production-ready logger with structured logging

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  [key: string]: any
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: {
    name: string
    message: string
    stack?: string
  }
  user?: {
    id: string
    email: string
  }
  browser?: {
    userAgent: string
    url: string
    referrer: string
  }
  sessionId?: string
}

class Logger {
  private static instance: Logger
  private logBuffer: LogEntry[] = []
  private maxBufferSize = 100
  private flushInterval = 30000 // 30 seconds
  private sessionId: string

  private constructor() {
    this.sessionId = this.generateSessionId()
    
    // Set up periodic flush
    if (typeof window !== 'undefined' && process.env.NODE_ENV === 'production') {
      setInterval(() => this.flush(), this.flushInterval)
      
      // Flush on page unload
      window.addEventListener('beforeunload', () => this.flush())
    }
  }

  static getInstance(): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger()
    }
    return Logger.instance
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private shouldLog(level: LogLevel): boolean {
    if (process.env.NODE_ENV === 'development') {
      return true
    }

    // In production, only log info and above
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error']
    const currentLevelIndex = levels.indexOf(level)
    const minLevelIndex = levels.indexOf('info')
    
    return currentLevelIndex >= minLevelIndex
  }

  private formatLog(entry: LogEntry): void {
    if (process.env.NODE_ENV === 'development') {
      // Console output for development
      const style = this.getConsoleStyle(entry.level)
      console.log(
        `%c[${entry.level.toUpperCase()}] ${entry.timestamp} - ${entry.message}`,
        style
      )
      
      if (entry.context) {
        console.log('Context:', entry.context)
      }
      
      if (entry.error) {
        console.error('Error:', entry.error)
      }
    }
  }

  private getConsoleStyle(level: LogLevel): string {
    switch (level) {
      case 'debug':
        return 'color: #888'
      case 'info':
        return 'color: #2196F3'
      case 'warn':
        return 'color: #FF9800'
      case 'error':
        return 'color: #F44336; font-weight: bold'
      default:
        return ''
    }
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      sessionId: this.sessionId,
    }

    if (context) {
      entry.context = context
    }

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      }
    }

    // Add browser info if available
    if (typeof window !== 'undefined') {
      entry.browser = {
        userAgent: window.navigator.userAgent,
        url: window.location.href,
        referrer: document.referrer,
      }
    }

    // Add user info if available (you'll need to implement getUserInfo)
    const userInfo = this.getUserInfo()
    if (userInfo) {
      entry.user = userInfo
    }

    return entry
  }

  private getUserInfo(): { id: string; email: string } | null {
    // Try to get user info from localStorage
    if (typeof window !== 'undefined') {
      try {
        const userStr = localStorage.getItem('auth_user')
        if (userStr) {
          const user = JSON.parse(userStr)
          return { id: user.id, email: user.email }
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
    return null
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry)
    
    // Trim buffer if it exceeds max size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer = this.logBuffer.slice(-this.maxBufferSize)
    }
    
    // Immediate flush for errors in production
    if (entry.level === 'error' && process.env.NODE_ENV === 'production') {
      this.flush()
    }
  }

  private async flush(): Promise<void> {
    if (this.logBuffer.length === 0) return

    const logsToSend = [...this.logBuffer]
    this.logBuffer = []

    try {
      // In production, send logs to your logging service
      if (process.env.NODE_ENV === 'production') {
        // DISABLED: No logging endpoint configured yet
        // TODO: Implement /api/logs endpoint or use external logging service
        // const response = await fetch('/api/logs', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({ logs: logsToSend }),
        // })
        // if (!response.ok) {
        //   this.logBuffer = logsToSend.concat(this.logBuffer)
        // }

        // For now, just log to console in production
        console.log('Logs to send:', logsToSend)
      }
    } catch (error) {
      // Re-add logs to buffer if send failed
      this.logBuffer = logsToSend.concat(this.logBuffer)
      console.error('Failed to send logs:', error)
    }
  }

  // Public logging methods
  debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return
    
    const entry = this.createLogEntry('debug', message, context)
    this.formatLog(entry)
    this.addToBuffer(entry)
  }

  info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return
    
    const entry = this.createLogEntry('info', message, context)
    this.formatLog(entry)
    this.addToBuffer(entry)
  }

  warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return
    
    const entry = this.createLogEntry('warn', message, context)
    this.formatLog(entry)
    this.addToBuffer(entry)
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (!this.shouldLog('error')) return
    
    const entry = this.createLogEntry('error', message, context, error)
    this.formatLog(entry)
    this.addToBuffer(entry)
  }

  // Track specific events
  trackEvent(eventName: string, properties?: LogContext): void {
    this.info(`Event: ${eventName}`, { event: eventName, ...properties })
  }

  // Track API calls
  trackApiCall(method: string, url: string, duration: number, status?: number, error?: Error): void {
    const context: LogContext = {
      api: {
        method,
        url,
        duration,
        status,
      }
    }

    if (error) {
      this.error(`API Error: ${method} ${url}`, error, context)
    } else if (status && status >= 400) {
      this.warn(`API Error Response: ${method} ${url} - ${status}`, context)
    } else {
      this.info(`API Call: ${method} ${url}`, context)
    }
  }

  // Track performance
  trackPerformance(metricName: string, duration: number, metadata?: LogContext): void {
    this.info(`Performance: ${metricName}`, {
      performance: {
        metric: metricName,
        duration,
        ...metadata,
      }
    })
  }

  // Manually flush logs
  forceFlush(): Promise<void> {
    return this.flush()
  }
}

// Export singleton instance
export const logger = Logger.getInstance()

// Convenience functions
export function logDebug(message: string, context?: LogContext): void {
  logger.debug(message, context)
}

export function logInfo(message: string, context?: LogContext): void {
  logger.info(message, context)
}

export function logWarn(message: string, context?: LogContext): void {
  logger.warn(message, context)
}

export function logError(message: string, error?: Error, context?: LogContext): void {
  logger.error(message, error, context)
}

export function trackEvent(eventName: string, properties?: LogContext): void {
  logger.trackEvent(eventName, properties)
}

export function trackApiCall(method: string, url: string, duration: number, status?: number, error?: Error): void {
  logger.trackApiCall(method, url, duration, status, error)
}

export function trackPerformance(metricName: string, duration: number, metadata?: LogContext): void {
  logger.trackPerformance(metricName, duration, metadata)
}

// React hook for tracking component lifecycle
export function useComponentLogger(componentName: string) {
  useEffect(() => {
    logDebug(`Component mounted: ${componentName}`)
    
    return () => {
      logDebug(`Component unmounted: ${componentName}`)
    }
  }, [componentName])
  
  return {
    logEvent: (event: string, data?: LogContext) => 
      trackEvent(`${componentName}.${event}`, data),
    logError: (message: string, error?: Error, context?: LogContext) =>
      logError(`[${componentName}] ${message}`, error, context),
  }
}

// Performance tracking helper
export function measurePerformance<T>(
  operation: string,
  fn: () => T | Promise<T>
): T | Promise<T> {
  const start = performance.now()
  
  try {
    const result = fn()
    
    if (result instanceof Promise) {
      return result.finally(() => {
        const duration = performance.now() - start
        trackPerformance(operation, duration)
      })
    }
    
    const duration = performance.now() - start
    trackPerformance(operation, duration)
    return result
  } catch (error) {
    const duration = performance.now() - start
    trackPerformance(operation, duration, { error: true })
    throw error
  }
}

// Add missing import for useEffect
import { useEffect } from 'react'

