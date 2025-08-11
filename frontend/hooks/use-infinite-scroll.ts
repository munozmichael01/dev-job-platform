import { useEffect, useRef, useState, useCallback } from 'react'

interface UseInfiniteScrollOptions {
  hasMore: boolean
  isLoading: boolean
  onLoadMore: () => void
  threshold?: number
}

export function useInfiniteScroll({
  hasMore,
  isLoading,
  onLoadMore,
  threshold = 100
}: UseInfiniteScrollOptions) {
  const [isFetching, setIsFetching] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const observerRef = useRef<IntersectionObserver | null>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const lastCallRef = useRef<number>(0)
  const isObservingRef = useRef<boolean>(false) // Flag para tracking

  // Callback optimizado contra bucles pero funcional
  const handleLoadMore = useCallback(() => {
    const now = Date.now()
    
    // Throttle de 150ms
    if (now - lastCallRef.current < 150) {
      console.log('🚫 InfiniteScroll: Throttled, too soon')
      return
    }
    
    if (!hasMore || isLoading || isFetching) {
      console.log('🚫 InfiniteScroll: Conditions not met', { hasMore, isLoading, isFetching })
      return
    }

    console.log('📞 InfiniteScroll: Triggering loadMore')
    
    lastCallRef.current = now
    setIsFetching(true)
    
    onLoadMore()
  }, [hasMore, isLoading, isFetching, onLoadMore])

  // CRÍTICO: Configurar IntersectionObserver con control estricto
  useEffect(() => {
    if (!containerRef.current) return

    // Limpiar observer anterior si existe
    if (observerRef.current) {
      observerRef.current.disconnect()
      isObservingRef.current = false
    }

    // Crear elemento sentinel al final del contenedor
    if (!sentinelRef.current) {
      const sentinel = document.createElement('div')
      sentinel.style.height = '1px'
      sentinel.style.width = '100%'
      sentinel.className = 'infinite-scroll-sentinel'
      sentinelRef.current = sentinel
    }

    const container = containerRef.current
    if (!container.contains(sentinelRef.current)) {
      container.appendChild(sentinelRef.current)
    }

    // Observer funcional con protección simple
    observerRef.current = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry.isIntersecting) {
          console.log('👁️ Sentinel visible, checking conditions...')
          handleLoadMore()
        }
      },
      {
        root: container,
        rootMargin: `${threshold}px`,
        threshold: 0.1
      }
    )

    // Siempre observar - las condiciones se verifican en handleLoadMore
    observerRef.current.observe(sentinelRef.current)
    isObservingRef.current = true
    console.log('🟢 Observer creado y observando')

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect()
        isObservingRef.current = false
      }
      if (sentinelRef.current && container.contains(sentinelRef.current)) {
        container.removeChild(sentinelRef.current)
      }
    }
  }, [handleLoadMore, threshold])

  // Reset isFetching cuando termine la carga
  useEffect(() => {
    if (!isLoading) {
      setIsFetching(false)
    }
  }, [isLoading])

  return { containerRef, isFetching }
}

