"use client";

import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { getChannelCapabilities, hasLimits, type ChannelCapabilities } from '@/lib/channelCapabilities';

interface ChannelCapabilitiesBannerProps {
  channelId: string;
  className?: string;
}

export function ChannelCapabilitiesBanner({ channelId, className }: ChannelCapabilitiesBannerProps) {
  const capabilities = getChannelCapabilities(channelId);
  
  if (!capabilities) {
    return null;
  }
  
  const hasSpecificLimits = hasLimits(channelId);
  
  return (
    <Card className={`border-blue-200 bg-blue-50 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Info className="h-5 w-5" />
          {capabilities.name} - Capacidades del Canal
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Información básica */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="secondary" className="bg-blue-100 text-blue-800">
            {capabilities.costModel}
          </Badge>
          <Badge variant="secondary" className="bg-green-100 text-green-800">
            CPA promedio: €{capabilities.avgCPA}
          </Badge>
        </div>
        
        {/* Descripción */}
        <p className="text-sm text-blue-700">
          {capabilities.description}
        </p>
        
        {/* Límites específicos */}
        {hasSpecificLimits && (
          <div className="space-y-2">
            <h4 className="font-medium text-blue-900 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Límites de Segmentación
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Títulos */}
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  <strong>Job titles:</strong> máx. {capabilities.limits.titles.max || 'ilimitados'}
                  {capabilities.limits.titles.max && (
                    <span className="text-gray-600 ml-1">({capabilities.limits.titles.operator})</span>
                  )}
                </span>
              </div>
              
              {/* Empresas */}
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  <strong>Companies:</strong> máx. {capabilities.limits.companies.max || 'ilimitadas'}
                  {capabilities.limits.companies.max && (
                    <span className="text-gray-600 ml-1">({capabilities.limits.companies.operator})</span>
                  )}
                </span>
              </div>
              
              {/* Ubicaciones */}
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>
                  <strong>Locations:</strong> {capabilities.limits.locations.max ? `máx. ${capabilities.limits.locations.max}` : 'deduplicadas'}
                  {capabilities.limits.locations.operator !== 'none' && (
                    <span className="text-gray-600 ml-1">({capabilities.limits.locations.operator})</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* Notas importantes */}
        {capabilities.notes.length > 0 && (
          <Alert className="border-blue-200 bg-blue-50">
            <Info className="h-4 w-4" />
            <AlertDescription>
              <ul className="list-disc list-inside space-y-1 text-sm">
                {capabilities.notes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}
        
        {/* Features */}
        <div className="space-y-2">
          <h4 className="font-medium text-blue-900">Características</h4>
          <div className="flex flex-wrap gap-1">
            {capabilities.features.map((feature, index) => (
              <Badge key={index} variant="outline" className="text-xs border-blue-300 text-blue-700">
                {feature}
              </Badge>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default ChannelCapabilitiesBanner;


