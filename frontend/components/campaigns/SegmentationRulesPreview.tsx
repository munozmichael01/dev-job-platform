"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Eye, Code2, CheckCircle } from 'lucide-react';
import { getChannelCapabilities, applyChannelLimits } from '@/lib/channelCapabilities';

interface SegmentationRulesPreviewProps {
  channelId: string;
  titles?: string[];
  companies?: string[];
  locations?: string[];
  className?: string;
}

interface SegmentationRule {
  type: number;
  value: string;
  operator: string;
}

export function SegmentationRulesPreview({
  channelId,
  titles = [],
  companies = [],
  locations = [],
  className
}: SegmentationRulesPreviewProps) {
  const capabilities = getChannelCapabilities(channelId);
  
  const segmentationRules = useMemo((): SegmentationRule[] => {
    if (!capabilities) return [];
    
    // Aplicar límites y deduplicación
    const limited = applyChannelLimits(channelId, { titles, companies, locations });
    const rules: SegmentationRule[] = [];
    
    // Títulos (type 1)
    if (capabilities.limits.titles.max !== null) {
      limited.titles.forEach(title => {
        rules.push({
          type: capabilities.limits.titles.type,
          value: title,
          operator: capabilities.limits.titles.operator
        });
      });
    }
    
    // Empresas (type 2)
    if (capabilities.limits.companies.max !== null) {
      limited.companies.forEach(company => {
        rules.push({
          type: capabilities.limits.companies.type,
          value: company,
          operator: capabilities.limits.companies.operator
        });
      });
    }
    
    // Ubicaciones (type 4)
    if (capabilities.limits.locations.operator !== 'none' && limited.locations.length > 0) {
      rules.push({
        type: capabilities.limits.locations.type,
        value: limited.locations.join(','),
        operator: capabilities.limits.locations.operator
      });
    }
    
    return rules;
  }, [channelId, titles, companies, locations, capabilities]);
  
  if (!capabilities || segmentationRules.length === 0) {
    return null;
  }
  
  const hasRules = segmentationRules.length > 0;
  
  return (
    <Card className={`border-gray-200 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-gray-800">
          <Eye className="h-4 w-4" />
          Vista Previa - segmentationRules para {capabilities.name}
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {hasRules ? (
          <>
            {/* Resumen */}
            <div className="flex items-center gap-2 text-sm text-green-700">
              <CheckCircle className="h-4 w-4" />
              <span>{segmentationRules.length} reglas de segmentación generadas automáticamente</span>
            </div>
            
            {/* Vista estructurada */}
            <div className="space-y-3">
              {/* Títulos */}
              {segmentationRules.filter(r => r.type === 1).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Job Titles (type 1, operator: contains)
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {segmentationRules
                      .filter(r => r.type === 1)
                      .map((rule, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          "{rule.value}"
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
              
              {/* Empresas */}
              {segmentationRules.filter(r => r.type === 2).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Companies (type 2, operator: equals)
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {segmentationRules
                      .filter(r => r.type === 2)
                      .map((rule, index) => (
                        <Badge key={index} variant="secondary" className="text-xs">
                          "{rule.value}"
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
              
              {/* Ubicaciones */}
              {segmentationRules.filter(r => r.type === 4).length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-2">
                    Locations (type 4, operator: in)
                  </h4>
                  <div className="flex flex-wrap gap-1">
                    {segmentationRules
                      .filter(r => r.type === 4)
                      .map((rule) => 
                        rule.value.split(',').map((location, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            "{location.trim()}"
                          </Badge>
                        ))
                      )}
                  </div>
                </div>
              )}
            </div>
            
            {/* Vista de código JSON */}
            <details className="text-sm">
              <summary className="cursor-pointer text-gray-600 hover:text-gray-800 flex items-center gap-2">
                <Code2 className="h-4 w-4" />
                Ver JSON que se enviará a {capabilities.name}
              </summary>
              <div className="mt-2 p-3 bg-gray-50 rounded border font-mono text-xs overflow-x-auto">
                <pre>{JSON.stringify(segmentationRules, null, 2)}</pre>
              </div>
            </details>
          </>
        ) : (
          <div className="text-sm text-gray-500 text-center py-4">
            No hay segmentación específica para este canal.
            Se enviará el feed completo según la selección de ofertas.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default SegmentationRulesPreview;

