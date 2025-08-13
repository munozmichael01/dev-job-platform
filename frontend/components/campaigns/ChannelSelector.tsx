"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Settings, 
  DollarSign,
  Target,
  TrendingUp,
  Zap,
  Shield
} from 'lucide-react';
import Link from 'next/link';

interface ChannelInfo {
  id: string;
  name: string;
  type: string;
  description: string;
  avgCPA: number;
  costModel: string;
  features: string[];
}

interface UserChannelCredentials {
  channelId: string;
  channelName: string;
  isActive: boolean;
  isValidated: boolean;
  validationError: string | null;
  limits: {
    dailyBudgetLimit: number | null;
    monthlyBudgetLimit: number | null;
    maxCPA: number | null;
  };
}

interface ChannelSelectorProps {
  selectedChannels: string[];
  onChannelToggle: (channelId: string) => void;
  distributionType: 'automatic' | 'manual';
  campaignBudget?: number;
  userId?: number;
}

export default function ChannelSelector({ 
  selectedChannels, 
  onChannelToggle, 
  distributionType,
  campaignBudget,
  userId = 1 // Por ahora hardcodeado
}: ChannelSelectorProps) {
  const [availableChannels, setAvailableChannels] = useState<ChannelInfo[]>([]);
  const [userCredentials, setUserCredentials] = useState<UserChannelCredentials[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadChannelsData();
  }, []);

  const loadChannelsData = async () => {
    try {
      // Cargar credenciales del usuario
      const credentialsResponse = await fetch(`http://localhost:3002/api/users/${userId}/credentials`);
      const credentialsData = await credentialsResponse.json();
      setUserCredentials(credentialsData.channels || []);
      
      // Cargar canales disponibles desde la API del backend
      const channelsResponse = await fetch('http://localhost:3002/api/credentials/channels');
      if (channelsResponse.ok) {
        const channelsData = await channelsResponse.json();
        
        // Convertir el formato de la API a nuestro formato local
        const formattedChannels = Object.entries(channelsData.channels || {}).map(([id, info]: [string, any]) => ({
          id,
          name: info.name,
          type: info.type,
          description: info.description,
          avgCPA: getChannelAvgCPA(id), // Función auxiliar para obtener CPA
          costModel: getCostModel(info.type),
          features: info.requiredCredentials || []
        }));
        
        setAvailableChannels(formattedChannels);
      } else {
        console.warn('No se pudieron cargar canales desde API, usando fallback');
        // Fallback solo si la API falla completamente
        const fallbackChannels = [
          {
            id: 'jooble',
            name: 'Jooble',
            type: 'CPC',
            description: 'Motor de búsqueda de empleo global con modelo CPC',
            avgCPA: 15,
            costModel: 'CPC',
            features: ['apiKey', 'countryCode']
          },
          {
            id: 'talent',
            name: 'Talent.com',
            type: 'CPA',
            description: 'Plataforma de reclutamiento con modelo de costo por aplicación',
            avgCPA: 18,
            costModel: 'CPA',
            features: ['publisherName', 'publisherUrl', 'partnerEmail']
          },
          {
            id: 'jobrapido',
            name: 'JobRapido',
            type: 'Organic',
            description: 'Agregador de ofertas con distribución orgánica y webhooks',
            avgCPA: 12,
            costModel: 'Organic',
            features: ['partnerId', 'partnerEmail']
          },
          {
            id: 'whatjobs',
            name: 'WhatJobs',
            type: 'XML Feed + CPC',
            description: 'Motor de búsqueda global con optimización automática via S2S tracking',
            avgCPA: 14,
            costModel: 'CPC',
            features: ['authKey', 'country']
          }
        ];
        setAvailableChannels(fallbackChannels);
      }
      
    } catch (error) {
      console.error('Error cargando datos de canales:', error);
      // En caso de error de red, usar fallback
      const fallbackChannels = [
        {
          id: 'jooble',
          name: 'Jooble',
          type: 'CPC',
          description: 'Motor de búsqueda de empleo global con modelo CPC',
          avgCPA: 15,
          costModel: 'CPC',
          features: ['apiKey', 'countryCode']
        },
        {
          id: 'talent',
          name: 'Talent.com',
          type: 'CPA',
          description: 'Plataforma de reclutamiento con modelo de costo por aplicación',
          avgCPA: 18,
          costModel: 'CPA',
          features: ['publisherName', 'publisherUrl', 'partnerEmail']
        },
        {
          id: 'jobrapido',
          name: 'JobRapido',
          type: 'Organic',
          description: 'Agregador de ofertas con distribución orgánica y webhooks',
          avgCPA: 12,
          costModel: 'Organic',
          features: ['partnerId', 'partnerEmail']
        },
        {
          id: 'whatjobs',
          name: 'WhatJobs',
          type: 'XML Feed + CPC',
          description: 'Motor de búsqueda global con optimización automática via S2S tracking',
          avgCPA: 14,
          costModel: 'CPC',
          features: ['authKey', 'country']
        }
      ];
      setAvailableChannels(fallbackChannels);
    } finally {
      setLoading(false);
    }
  };

  // Funciones auxiliares para mapear datos de la API
  const getChannelAvgCPA = (channelId: string): number => {
    const cpaMappings: Record<string, number> = {
      'jooble': 15,
      'talent': 18,
      'jobrapido': 12,
      'whatjobs': 14,
      'infojobs': 20,
      'linkedin': 25,
      'indeed': 22
    };
    return cpaMappings[channelId] || 20;
  };

  const getCostModel = (type: string): string => {
    if (type.toLowerCase().includes('cpc')) return 'CPC';
    if (type.toLowerCase().includes('cpa')) return 'CPA';
    if (type.toLowerCase().includes('organic')) return 'Organic';
    return type;
  };

  const getChannelStatus = (channelId: string) => {
    const credentials = userCredentials.find(c => c.channelId === channelId);
    
    if (!credentials) {
      return { status: 'not_configured', color: 'secondary', icon: Settings };
    }
    if (!credentials.isActive) {
      return { status: 'inactive', color: 'secondary', icon: XCircle };
    }
    if (!credentials.isValidated) {
      return { status: 'pending', color: 'yellow', icon: AlertTriangle };
    }
    if (credentials.validationError) {
      return { status: 'error', color: 'destructive', icon: XCircle };
    }
    return { status: 'ready', color: 'green', icon: CheckCircle };
  };

  const getStatusText = (status: string) => {
    const statusMap = {
      'ready': 'Listo',
      'not_configured': 'No configurado',
      'inactive': 'Inactivo',
      'pending': 'Pendiente validación',
      'error': 'Error'
    };
    return statusMap[status as keyof typeof statusMap] || status;
  };

  const canSelectChannel = (channelId: string) => {
    const statusInfo = getChannelStatus(channelId);
    return statusInfo.status === 'ready';
  };

  const getChannelLimits = (channelId: string) => {
    const credentials = userCredentials.find(c => c.channelId === channelId);
    return credentials?.limits || {};
  };

  const calculateChannelBudget = (channelId: string) => {
    if (!campaignBudget) return null;
    
    const selectedCount = selectedChannels.length || 1;
    const baseAllocation = campaignBudget / selectedCount;
    
    const limits = getChannelLimits(channelId);
    if (limits.monthlyBudgetLimit && baseAllocation > limits.monthlyBudgetLimit) {
      return limits.monthlyBudgetLimit;
    }
    
    return baseAllocation;
  };

  const getEstimatedApplications = (channelId: string) => {
    const budget = calculateChannelBudget(channelId);
    const channel = availableChannels.find(c => c.id === channelId);
    
    if (!budget || !channel) return null;
    
    return Math.floor(budget / channel.avgCPA);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span>Cargando canales...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const configuredChannels = availableChannels.filter(channel => 
    userCredentials.some(cred => cred.channelId === channel.id && cred.isActive)
  );
  
  const notConfiguredChannels = availableChannels.filter(channel => 
    !userCredentials.some(cred => cred.channelId === channel.id && cred.isActive)
  );

  return (
    <div className="space-y-6">
      {/* Resumen de selección */}
      {selectedChannels.length > 0 && (
        <Alert>
          <Target className="h-4 w-4" />
          <AlertDescription>
            <strong>{selectedChannels.length} canal(es) seleccionado(s)</strong>
            {campaignBudget && (
              <span> • Presupuesto promedio por canal: €{Math.round(campaignBudget / selectedChannels.length)}</span>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Canales configurados */}
      {configuredChannels.length > 0 && (
        <div>
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Canales Configurados ({configuredChannels.length})
          </h4>
          <div className="grid gap-3">
            {configuredChannels.map((channel) => {
              const statusInfo = getChannelStatus(channel.id);
              const StatusIcon = statusInfo.icon;
              const isSelected = selectedChannels.includes(channel.id);
              const isReady = canSelectChannel(channel.id);
              const credentials = userCredentials.find(c => c.channelId === channel.id);
              const estimatedBudget = calculateChannelBudget(channel.id);
              const estimatedApps = getEstimatedApplications(channel.id);
              
              return (
                <Card key={channel.id} className={`transition-all ${
                  isSelected ? 'ring-2 ring-primary border-primary' : ''
                } ${!isReady ? 'opacity-60' : ''}`}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Checkbox
                        id={channel.id}
                        checked={isSelected}
                        onCheckedChange={() => isReady && distributionType === 'manual' && onChannelToggle(channel.id)}
                        disabled={!isReady || distributionType === 'automatic'}
                      />
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-2">
                          <Label htmlFor={channel.id} className="font-medium cursor-pointer">
                            {channel.name}
                          </Label>
                          <Badge 
                            variant={statusInfo.color as any}
                            className="flex items-center gap-1 text-xs"
                          >
                            <StatusIcon className="h-3 w-3" />
                            {getStatusText(statusInfo.status)}
                          </Badge>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-3">
                          {channel.description}
                        </p>

                        {/* Métricas del canal */}
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3 text-green-600" />
                            <span>CPA promedio: €{channel.avgCPA}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <TrendingUp className="h-3 w-3 text-blue-600" />
                            <span>Modelo: {channel.costModel}</span>
                          </div>
                        </div>

                        {/* Proyecciones si está seleccionado */}
                        {isSelected && estimatedBudget && (
                          <div className="mt-3 p-2 bg-primary/5 rounded border-l-2 border-primary">
                            <div className="text-xs space-y-1">
                              <div className="flex justify-between">
                                <span>Presupuesto estimado:</span>
                                <span className="font-medium">€{Math.round(estimatedBudget)}</span>
                              </div>
                              {estimatedApps && (
                                <div className="flex justify-between">
                                  <span>Aplicaciones estimadas:</span>
                                  <span className="font-medium">{estimatedApps}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Límites configurados */}
                        {credentials && (credentials.limits.dailyBudgetLimit || credentials.limits.maxCPA) && (
                          <div className="mt-2 text-xs text-muted-foreground">
                            Límites: 
                            {credentials.limits.dailyBudgetLimit && (
                              <span> Diario €{credentials.limits.dailyBudgetLimit}</span>
                            )}
                            {credentials.limits.maxCPA && (
                              <span> • CPA máx €{credentials.limits.maxCPA}</span>
                            )}
                          </div>
                        )}

                        {/* Error de validación */}
                        {credentials?.validationError && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertTriangle className="h-3 w-3" />
                            <AlertDescription className="text-xs">
                              {credentials.validationError}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Canales no configurados */}
      {notConfiguredChannels.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="font-medium flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Canales Disponibles ({notConfiguredChannels.length})
            </h4>
            <Link href="/credenciales">
              <Button size="sm" variant="outline">
                <Settings className="h-3 w-3 mr-1" />
                Configurar Credenciales
              </Button>
            </Link>
          </div>
          
          <div className="grid gap-3">
            {notConfiguredChannels.map((channel) => (
              <Card key={channel.id} className="opacity-60">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h5 className="font-medium">{channel.name}</h5>
                      <p className="text-sm text-muted-foreground">{channel.description}</p>
                      <div className="text-xs text-muted-foreground mt-1">
                        CPA promedio: €{channel.avgCPA} • {channel.costModel}
                      </div>
                    </div>
                    <Badge variant="secondary">No configurado</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recomendaciones automáticas */}
      {distributionType === 'automatic' && configuredChannels.length > 0 && (
        <Alert>
          <Zap className="h-4 w-4" />
          <AlertDescription>
            <strong>Distribución automática:</strong> El sistema seleccionará automáticamente los mejores canales 
            basado en performance histórica y límites configurados.
          </AlertDescription>
        </Alert>
      )}

      {/* Mensaje si no hay canales configurados */}
      {configuredChannels.length === 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No tienes canales configurados. 
            <Link href="/credenciales" className="ml-1 underline">
              Configura tus credenciales primero
            </Link> para poder crear campañas.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

// Funciones auxiliares
function getChannelCPA(channelId: string): number {
  const cpas = {
    'talent': 18,
    'jooble': 15,
    'jobrapido': 12,
    'infojobs': 20,
    'linkedin': 25,
    'indeed': 22
  };
  return cpas[channelId as keyof typeof cpas] || 20;
}

function getCostModel(channelId: string): string {
  const models = {
    'talent': 'CPA',
    'jooble': 'CPC',
    'jobrapido': 'Organic',
    'infojobs': 'CPA',
    'linkedin': 'CPC',
    'indeed': 'CPC'
  };
  return models[channelId as keyof typeof models] || 'CPA';
}
