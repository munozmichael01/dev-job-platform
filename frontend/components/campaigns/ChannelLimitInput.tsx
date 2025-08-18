"use client";

import React, { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Info } from 'lucide-react';
import { getChannelCapabilities } from '@/lib/channelCapabilities';
import { cn } from '@/lib/utils';

interface ChannelLimitInputProps {
  channelId: string;
  fieldType: 'titles' | 'companies' | 'locations';
  values: string[];
  className?: string;
  children: React.ReactNode;
}

export function ChannelLimitInput({ 
  channelId, 
  fieldType, 
  values, 
  className,
  children 
}: ChannelLimitInputProps) {
  const capabilities = getChannelCapabilities(channelId);
  
  const analysis = useMemo(() => {
    if (!capabilities) {
      return {
        uniqueValues: values,
        count: values.length,
        limit: null,
        isOverLimit: false,
        status: 'ok' as const,
        message: '',
        operator: 'none'
      };
    }
    
    const limit = capabilities.limits[fieldType];
    const uniqueValues = [...new Set(values.filter(Boolean))];
    const count = uniqueValues.length;
    const isOverLimit = limit.max !== null && count > limit.max;
    
    let status: 'ok' | 'warning' | 'error' = 'ok';
    let message = '';
    
    if (isOverLimit) {
      status = 'error';
      message = `Excede el límite de ${limit.max}. Se usarán los primeros ${limit.max}.`;
    } else if (limit.max !== null && count === limit.max) {
      status = 'warning';
      message = `Límite alcanzado (${limit.max}/${limit.max})`;
    } else if (fieldType === 'locations' && count > 10) {
      status = 'warning';
      message = `Muchas ubicaciones (${count}). Se mantendrán las primeras 10 por performance.`;
    }
    
    return {
      uniqueValues,
      count,
      limit: limit.max,
      isOverLimit,
      status,
      message,
      operator: limit.operator,
      description: limit.description
    };
  }, [capabilities, fieldType, values]);
  
  if (!capabilities) {
    return <div className={className}>{children}</div>;
  }
  
  const { count, limit, status, message, operator, description } = analysis;
  
  return (
    <div className={cn("space-y-2", className)}>
      {/* Input principal */}
      <div className="relative">
        {children}
        
        {/* Badge de contador */}
        {limit !== null && (
          <div className="absolute top-2 right-2 pointer-events-none">
            <Badge 
              variant={status === 'error' ? 'destructive' : status === 'warning' ? 'secondary' : 'outline'}
              className={cn(
                "text-xs font-mono",
                status === 'ok' && "bg-green-100 text-green-800 border-green-300",
                status === 'warning' && "bg-yellow-100 text-yellow-800 border-yellow-300"
              )}
            >
              {count}/{limit}
            </Badge>
          </div>
        )}
      </div>
      
      {/* Información y estados */}
      <div className="space-y-1">
        {/* Descripción del operador */}
        {operator !== 'none' && description && (
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Info className="h-3 w-3" />
            <span>{description}</span>
          </div>
        )}
        
        {/* Mensaje de estado */}
        {message && (
          <div className={cn(
            "flex items-center gap-2 text-sm",
            status === 'error' && "text-red-600",
            status === 'warning' && "text-yellow-600",
            status === 'ok' && "text-green-600"
          )}>
            {status === 'error' && <AlertCircle className="h-3 w-3" />}
            {status === 'warning' && <AlertCircle className="h-3 w-3" />}
            {status === 'ok' && <CheckCircle className="h-3 w-3" />}
            <span>{message}</span>
          </div>
        )}
        
        {/* Lista de valores únicos (solo si hay duplicados) */}
        {values.length !== analysis.uniqueValues.length && (
          <div className="text-xs text-gray-500">
            Duplicados eliminados: {values.length - analysis.uniqueValues.length}
          </div>
        )}
        
        {/* Preview de valores que se enviarán */}
        {limit !== null && analysis.uniqueValues.length > 0 && (
          <details className="text-xs">
            <summary className="cursor-pointer text-gray-500 hover:text-gray-700">
              Ver valores que se enviarán a {capabilities.name}
            </summary>
            <div className="mt-1 p-2 bg-gray-50 rounded border text-gray-700">
              {fieldType === 'locations' ? (
                <span className="font-mono">
                  "{analysis.uniqueValues.slice(0, limit || 10).join(',')}"
                </span>
              ) : (
                <ul className="list-disc list-inside space-y-0.5">
                  {analysis.uniqueValues.slice(0, limit || analysis.uniqueValues.length).map((value, index) => (
                    <li key={index} className="font-mono">"{value}" ({operator})</li>
                  ))}
                </ul>
              )}
              {analysis.isOverLimit && (
                <div className="mt-1 text-red-600 text-xs">
                  {analysis.uniqueValues.length - (limit || 0)} valores omitidos por límite del canal
                </div>
              )}
            </div>
          </details>
        )}
      </div>
    </div>
  );
}

export default ChannelLimitInput;

