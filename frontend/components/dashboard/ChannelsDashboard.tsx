"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Settings, 
  TrendingUp,
  TrendingDown,
  DollarSign,
  Target,
  Zap,
  BarChart3,
  Shield,
  Plus
} from 'lucide-react';
import Link from 'next/link';

interface ChannelStats {
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
  performance?: {
    monthlySpend: number;
    monthlyApplications: number;
    currentCPA: number;
    conversionRate: number;
  };
}

interface ChannelsDashboardProps {
  userId?: number;
}

export default function ChannelsDashboard({ userId = 1 }: ChannelsDashboardProps) {
  const [channels, setChannels] = useState<ChannelStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalStats, setTotalStats] = useState({
    totalSpend: 0,
    totalApplications: 0,
    avgCPA: 0,
    activeChannels: 0
  });

  useEffect(() => {
    loadChannelsData();
  }, []);

  const loadChannelsData = async () => {
    try {
      const response = await fetch(`http://localhost:3002/api/users/${userId}/credentials`);
      const data = await response.json();
      
      // Simular datos de performance (en implementación real vendrían del backend)
      const channelsWithPerformance = (data.channels || []).map((channel: any) => ({
        ...channel,
        performance: generateMockPerformance(channel.channelId)
      }));
      
      setChannels(channelsWithPerformance);
      calculateTotalStats(channelsWithPerformance);
      
    } catch (error) {
      console.error('Error cargando datos:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculateTotalStats = (channelsData: ChannelStats[]) => {
    const activeChannels = channelsData.filter(c => c.isActive && c.isValidated);
    const totalSpend = activeChannels.reduce((sum, c) => sum + (c.performance?.monthlySpend || 0), 0);
    const totalApplications = activeChannels.reduce((sum, c) => sum + (c.performance?.monthlyApplications || 0), 0);
    const avgCPA = totalApplications > 0 ? totalSpend / totalApplications : 0;

    setTotalStats({
      totalSpend,
      totalApplications,
      avgCPA,
      activeChannels: activeChannels.length
    });
  };

  const getChannelStatus = (channel: ChannelStats) => {
    if (!channel.isActive) {
      return { status: 'inactive', color: 'secondary', icon: XCircle, text: 'Inactivo' };
    }
    if (!channel.isValidated) {
      return { status: 'pending', color: 'yellow', icon: AlertTriangle, text: 'Pendiente' };
    }
    if (channel.validationError) {
      return { status: 'error', color: 'destructive', icon: XCircle, text: 'Error' };
    }
    return { status: 'active', color: 'green', icon: CheckCircle, text: 'Activo' };
  };

  const getBudgetUsage = (channel: ChannelStats) => {
    if (!channel.performance || !channel.limits.monthlyBudgetLimit) return null;
    
    const usage = (channel.performance.monthlySpend / channel.limits.monthlyBudgetLimit) * 100;
    return Math.min(usage, 100);
  };

  const getPerformanceTrend = (channel: ChannelStats) => {
    if (!channel.performance) return null;
    
    // Simular tendencia basada en CPA vs límite
    const targetCPA = channel.limits.maxCPA || 20;
    const currentCPA = channel.performance.currentCPA;
    
    if (currentCPA < targetCPA * 0.8) {
      return { direction: 'up', color: 'text-green-600', icon: TrendingUp };
    } else if (currentCPA > targetCPA * 1.2) {
      return { direction: 'down', color: 'text-red-600', icon: TrendingDown };
    }
    return { direction: 'stable', color: 'text-gray-600', icon: BarChart3 };
  };

  if (loading) {
    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-2">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Métricas generales */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Canales Activos</p>
                <p className="text-2xl font-bold">{totalStats.activeChannels}</p>
              </div>
              <Shield className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Gasto Mensual</p>
                <p className="text-2xl font-bold">€{totalStats.totalSpend.toFixed(0)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Aplicaciones</p>
                <p className="text-2xl font-bold">{totalStats.totalApplications}</p>
              </div>
              <Target className="h-8 w-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">CPA Promedio</p>
                <p className="text-2xl font-bold">€{totalStats.avgCPA.toFixed(1)}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estado de canales */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Estado de Canales</h3>
          <Link href="/credenciales">
            <Button size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Configurar Canal
            </Button>
          </Link>
        </div>

        {channels.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              No tienes canales configurados. 
              <Link href="/credenciales" className="ml-1 underline">
                Configura tus credenciales
              </Link> para empezar a distribuir ofertas.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {channels.map((channel) => {
              const statusInfo = getChannelStatus(channel);
              const StatusIcon = statusInfo.icon;
              const budgetUsage = getBudgetUsage(channel);
              const trend = getPerformanceTrend(channel);
              const TrendIcon = trend?.icon;

              return (
                <Card key={channel.channelId} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{channel.channelName}</CardTitle>
                      <Badge 
                        variant={statusInfo.color as any}
                        className="flex items-center gap-1"
                      >
                        <StatusIcon className="h-3 w-3" />
                        {statusInfo.text}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    {/* Performance este mes */}
                    {channel.performance && channel.isValidated && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground">Este mes:</span>
                          {trend && TrendIcon && (
                            <TrendIcon className={`h-4 w-4 ${trend.color}`} />
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-muted-foreground">Gasto</p>
                            <p className="font-medium">€{channel.performance.monthlySpend}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Aplicaciones</p>
                            <p className="font-medium">{channel.performance.monthlyApplications}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">CPA Actual</p>
                            <p className="font-medium">€{channel.performance.currentCPA.toFixed(1)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Conversión</p>
                            <p className="font-medium">{(channel.performance.conversionRate * 100).toFixed(1)}%</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Uso de presupuesto */}
                    {budgetUsage !== null && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Presupuesto usado</span>
                          <span className="font-medium">{budgetUsage.toFixed(0)}%</span>
                        </div>
                        <Progress 
                          value={budgetUsage} 
                          className={`h-2 ${budgetUsage > 80 ? 'bg-red-100' : budgetUsage > 60 ? 'bg-yellow-100' : 'bg-green-100'}`}
                        />
                        <div className="text-xs text-muted-foreground">
                          €{channel.performance?.monthlySpend || 0} / €{channel.limits.monthlyBudgetLimit}
                        </div>
                      </div>
                    )}

                    {/* Límites configurados */}
                    {(channel.limits.maxCPA || channel.limits.dailyBudgetLimit) && (
                      <div className="text-xs text-muted-foreground space-y-1">
                        <p className="font-medium">Límites:</p>
                        {channel.limits.maxCPA && (
                          <p>• CPA máximo: €{channel.limits.maxCPA}</p>
                        )}
                        {channel.limits.dailyBudgetLimit && (
                          <p>• Diario: €{channel.limits.dailyBudgetLimit}</p>
                        )}
                      </div>
                    )}

                    {/* Error de validación */}
                    {channel.validationError && (
                      <Alert variant="destructive" className="text-xs">
                        <AlertTriangle className="h-3 w-3" />
                        <AlertDescription>{channel.validationError}</AlertDescription>
                      </Alert>
                    )}

                    {/* Acciones */}
                    <div className="flex gap-2 pt-2">
                      <Link href="/credenciales" className="flex-1">
                        <Button size="sm" variant="outline" className="w-full">
                          <Settings className="h-3 w-3 mr-1" />
                          Configurar
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recomendaciones */}
      {channels.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Recomendaciones de Optimización
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {generateRecommendations(channels).map((rec, index) => (
                <Alert key={index} className={rec.type === 'warning' ? 'border-yellow-200' : 'border-blue-200'}>
                  {rec.type === 'warning' ? 
                    <AlertTriangle className="h-4 w-4" /> : 
                    <TrendingUp className="h-4 w-4" />
                  }
                  <AlertDescription>{rec.message}</AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Funciones auxiliares

function generateMockPerformance(channelId: string) {
  const baseMetrics = {
    talent: { spend: 150, apps: 8, cpa: 18.8 },
    jooble: { spend: 200, apps: 13, cpa: 15.4 },
    jobrapido: { spend: 80, apps: 7, cpa: 11.4 },
    infojobs: { spend: 120, apps: 6, cpa: 20.0 },
    linkedin: { spend: 300, apps: 12, cpa: 25.0 },
    indeed: { spend: 180, apps: 8, cpa: 22.5 }
  };

  const base = baseMetrics[channelId as keyof typeof baseMetrics] || { spend: 100, apps: 5, cpa: 20 };
  
  return {
    monthlySpend: base.spend + Math.floor(Math.random() * 50),
    monthlyApplications: base.apps + Math.floor(Math.random() * 5),
    currentCPA: base.cpa + (Math.random() - 0.5) * 4,
    conversionRate: 0.03 + Math.random() * 0.04 // 3-7%
  };
}

function generateRecommendations(channels: ChannelStats[]) {
  const recommendations = [];
  
  channels.forEach(channel => {
    if (!channel.isValidated && channel.isActive) {
      recommendations.push({
        type: 'warning',
        message: `${channel.channelName}: Credenciales pendientes de validación. Valida para activar distribución.`
      });
    }
    
    if (channel.performance && channel.limits.maxCPA) {
      if (channel.performance.currentCPA > channel.limits.maxCPA * 1.2) {
        recommendations.push({
          type: 'warning',
          message: `${channel.channelName}: CPA actual (€${channel.performance.currentCPA.toFixed(1)}) supera el límite configurado. Considera ajustar bids.`
        });
      }
    }
    
    if (channel.performance && channel.performance.conversionRate > 0.06) {
      recommendations.push({
        type: 'info',
        message: `${channel.channelName}: Excelente tasa de conversión (${(channel.performance.conversionRate * 100).toFixed(1)}%). Considera aumentar presupuesto.`
      });
    }
  });
  
  return recommendations.slice(0, 3); // Máximo 3 recomendaciones
}
