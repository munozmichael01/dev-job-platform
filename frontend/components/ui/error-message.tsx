import { AlertCircle, RefreshCw, Filter } from "lucide-react"
import { Button } from "./button"
import { Alert, AlertDescription } from "./alert"
import { cn } from "@/lib/utils"

interface ErrorMessageProps {
  error: string
  onRetry?: () => void
  onClearFilters?: () => void
  showClearFilters?: boolean
  className?: string
}

export function ErrorMessage({ 
  error, 
  onRetry, 
  onClearFilters,
  showClearFilters = false,
  className 
}: ErrorMessageProps) {
  // Determinar el tipo de error y mostrar mensaje apropiado
  const getErrorInfo = (errorMsg: string) => {
    if (errorMsg.includes('tardó demasiado tiempo') || errorMsg.includes('timeout')) {
      return {
        title: '⏱️ Búsqueda muy amplia',
        description: 'La consulta tardó demasiado tiempo. Prueba aplicar más filtros para ver resultados más rápidos.',
        suggestion: 'Usa filtros específicos como ubicación o sector para reducir los resultados.',
        showFilters: true
      }
    }
    
    if (errorMsg.includes('Error interno del servidor') || errorMsg.includes('500')) {
      return {
        title: '🔧 Problema temporal',
        description: 'No se pudieron cargar las ofertas. Comprueba tu conexión o vuelve a intentarlo.',
        suggestion: 'El servidor está experimentando problemas temporales.',
        showFilters: false
      }
    }
    
    if (errorMsg.includes('conexión') || errorMsg.includes('network') || errorMsg.includes('fetch')) {
      return {
        title: '🌐 Error de conexión',
        description: 'No se pudo conectar con el servidor. Verifica tu conexión a internet.',
        suggestion: 'Comprueba tu conexión y vuelve a intentarlo.',
        showFilters: false
      }
    }
    
    return {
      title: '❌ Error inesperado',
      description: errorMsg,
      suggestion: 'Si el problema persiste, contacta con soporte técnico.',
      showFilters: false
    }
  }

  const errorInfo = getErrorInfo(error)

  return (
    <div className={cn("w-full max-w-2xl mx-auto", className)}>
      <Alert variant="destructive" className="border-destructive/20">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="space-y-3">
          <div>
            <p className="font-medium text-destructive">{errorInfo.title}</p>
            <p className="text-sm mt-1">{errorInfo.description}</p>
            <p className="text-xs text-muted-foreground mt-2 italic">
              {errorInfo.suggestion}
            </p>
          </div>
          
          <div className="flex gap-2 pt-2">
            {onRetry && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onRetry}
                className="h-8"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Reintentar
              </Button>
            )}
            
            {showClearFilters && onClearFilters && errorInfo.showFilters && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={onClearFilters}
                className="h-8"
              >
                <Filter className="h-3 w-3 mr-1" />
                Limpiar filtros
              </Button>
            )}
          </div>
        </AlertDescription>
      </Alert>
    </div>
  )
}

