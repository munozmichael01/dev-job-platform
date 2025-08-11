import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface InfiniteLoaderProps {
  isLoading?: boolean
  hasMore?: boolean
  error?: string | null
  totalShown?: number
  totalAvailable?: number
  className?: string
}

export function InfiniteLoader({ 
  isLoading = false, 
  hasMore = true, 
  error = null,
  totalShown = 0,
  totalAvailable = 0,
  className 
}: InfiniteLoaderProps) {
  if (error) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <div className="text-center">
          <p className="text-sm text-destructive mb-2">⚠️ Error al cargar más resultados</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Cargando más ofertas...</span>
        </div>
      </div>
    )
  }

  if (!hasMore && totalShown > 0) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            ✅ Has visto todas las ofertas disponibles
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Total: {totalAvailable.toLocaleString()} ofertas
          </p>
        </div>
      </div>
    )
  }

  return null
}

interface ResultsCounterProps {
  showing: number
  total: number
  isLoading?: boolean
  className?: string
}

export function ResultsCounter({ 
  showing, 
  total, 
  isLoading = false,
  className 
}: ResultsCounterProps) {
  // SPEC: Si total===0 pero hay items, mostrar "Mostrando {shown} resultados"
  const displayText = total === 0 && showing > 0 
    ? `Mostrando ${showing.toLocaleString()} resultados`
    : `Mostrando ${showing.toLocaleString()} de ${total.toLocaleString()} resultados`;

  return (
    <div className={cn("flex items-center gap-2 text-sm text-muted-foreground", className)}>
      <span>
        {displayText.split(/(\d[\d,]*)/g).map((part, index) => 
          /\d/.test(part) ? (
            <strong key={index} className="text-foreground">{part}</strong>
          ) : (
            part
          )
        )}
      </span>
      {isLoading && (
        <Loader2 className="h-3 w-3 animate-spin ml-1" />
      )}
    </div>
  )
}

