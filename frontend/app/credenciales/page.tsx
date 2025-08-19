"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  Plus,
  Eye,
  EyeOff,
  Trash2,
  RefreshCw
} from 'lucide-react';
import ChannelConfigForm from '@/components/credentials/ChannelConfigForm';
import { useApi } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

interface ChannelCredentials {
  channelId: string;
  channelName: string;
  isActive: boolean;
  isValidated: boolean;
  lastValidated: string | null;
  validationError: string | null;
  limits: {
    dailyBudgetLimit: number | null;
    monthlyBudgetLimit: number | null;
    maxCPA: number | null;
  };
  createdAt: string;
  updatedAt: string;
}

interface ChannelInfo {
  name: string;
  type: string;
  requiredCredentials: string[];
  optionalCredentials: string[];
  description: string;
  setupInstructions: string;
}

export default function CredencialesPage() {
  const [userChannels, setUserChannels] = useState<ChannelCredentials[]>([]);
  const [availableChannels, setAvailableChannels] = useState<Record<string, ChannelInfo>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);
  const [showConfigForm, setShowConfigForm] = useState(false);

  // ✅ OBTENER USUARIO REAL DEL CONTEXTO
  const { user, fetchWithAuth } = useAuth();
  const api = useApi();

  useEffect(() => {
    loadUserChannels();
    loadAvailableChannels();
  }, []);

  const loadUserChannels = async () => {
    try {
      if (!user?.id) {
        setUserChannels([]);
        return;
      }
      
      const data = await api.fetchUserCredentials();
      setUserChannels(data.channels || []);
    } catch (error) {
      console.error('Error cargando canales:', error);
      setUserChannels([]);
    }
  };

  const loadAvailableChannels = async () => {
    try {
      // Cargar canales desde la API del backend usando fetch autenticado
      const response = await fetchWithAuth('http://localhost:3002/api/credentials/channels');
      if (response.ok) {
        const data = await response.json();
        setAvailableChannels(data.channels || {});
        console.log('✅ Canales cargados desde API:', Object.keys(data.channels || {}));
      } else {
        console.warn('No se pudieron cargar canales desde API, usando fallback');
        // Fallback a canales hardcodeados solo si la API falla
        const fallbackChannels = {
        jooble: {
          name: 'Jooble',
          type: 'CPC',
          description: 'Motor de búsqueda de empleo global con modelo CPC',
          requiredCredentials: ['apiKey', 'countryCode'],
          optionalCredentials: ['timeout'],
          setupInstructions: 'Contacta a tu manager de Jooble para obtener tu API Key única'
        },
        talent: {
          name: 'Talent.com',
          type: 'CPA',
          description: 'Plataforma de reclutamiento con modelo de costo por aplicación',
          requiredCredentials: ['publisherName', 'publisherUrl', 'partnerEmail'],
          optionalCredentials: ['feedUrl', 'postbackUrl'],
          setupInstructions: 'Regístrate como publisher en Talent.com y configura tu feed XML'
        },
        jobrapido: {
          name: 'JobRapido',
          type: 'Organic',
          description: 'Agregador de ofertas con distribución orgánica y webhooks',
          requiredCredentials: ['partnerId', 'partnerEmail'],
          optionalCredentials: ['partnerUsername', 'partnerPassword', 'webhookUrl', 'feedFormat'],
          setupInstructions: 'Solicita credenciales de partner a JobRapido y configura tu webhook'
        },
        whatjobs: {
          name: 'WhatJobs',
          type: 'XML Feed + CPC',
          description: 'Motor de búsqueda global con optimización automática via S2S tracking',
          requiredCredentials: ['authKey', 'country'],
          optionalCredentials: ['defaultCPC', 'feedUrl'],
          setupInstructions: 'Contacta a WhatJobs para obtener tu Authentication Key y selecciona el país objetivo'
        }
        };
        setAvailableChannels(fallbackChannels);
      }
    } catch (error) {
      console.error('Error cargando canales disponibles:', error);
      // En caso de error de red, usar fallback con WhatJobs incluido
      const fallbackChannels = {
        jooble: {
          name: 'Jooble',
          type: 'CPC',
          description: 'Motor de búsqueda de empleo global con modelo CPC',
          requiredCredentials: ['apiKey', 'countryCode'],
          optionalCredentials: ['timeout'],
          setupInstructions: 'Contacta a tu manager de Jooble para obtener tu API Key única'
        },
        talent: {
          name: 'Talent.com',
          type: 'CPA',
          description: 'Plataforma de reclutamiento con modelo de costo por aplicación',
          requiredCredentials: ['publisherName', 'publisherUrl', 'partnerEmail'],
          optionalCredentials: ['feedUrl', 'postbackUrl'],
          setupInstructions: 'Regístrate como publisher en Talent.com y configura tu feed XML'
        },
        jobrapido: {
          name: 'JobRapido',
          type: 'Organic',
          description: 'Agregador de ofertas con distribución orgánica y webhooks',
          requiredCredentials: ['partnerId', 'partnerEmail'],
          optionalCredentials: ['partnerUsername', 'partnerPassword', 'webhookUrl', 'feedFormat'],
          setupInstructions: 'Solicita credenciales de partner a JobRapido y configura tu webhook'
        },
        whatjobs: {
          name: 'WhatJobs',
          type: 'XML Feed + CPC',
          description: 'Motor de búsqueda global con optimización automática via S2S tracking',
          requiredCredentials: ['authKey', 'country'],
          optionalCredentials: ['defaultCPC', 'feedUrl'],
          setupInstructions: 'Contacta a WhatJobs para obtener tu Authentication Key y selecciona el país objetivo'
        }
        };
        setAvailableChannels(fallbackChannels);
    } finally {
      setLoading(false);
    }
  };

  const handleConfigureChannel = (channelId: string) => {
    setSelectedChannel(channelId);
    setShowConfigForm(true);
  };

  const handleDeleteCredentials = async (channelId: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar las credenciales de ${channelId}?`)) {
      return;
    }

    try {
      const response = await fetch(`http://localhost:3002/api/users/${user?.id}/credentials/${channelId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadUserChannels();
      } else {
        const data = await response.json();
        setError(data.error || 'Error eliminando credenciales');
      }
    } catch (error) {
      console.error('Error eliminando credenciales:', error);
      setError('Error eliminando credenciales');
    }
  };

  const handleValidateCredentials = async (channelId: string) => {
    try {
      const response = await fetch(`http://localhost:3002/api/users/${user?.id}/credentials/${channelId}/validate`, {
        method: 'POST'
      });

      const data = await response.json();
      
      if (data.success) {
        await loadUserChannels();
      } else {
        setError(`Error validando ${channelId}: ${data.validation?.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error validando credenciales:', error);
      setError('Error validando credenciales');
    }
  };

  const getChannelStatus = (channel: ChannelCredentials) => {
    if (!channel.isActive) {
      return { status: 'inactive', color: 'secondary', icon: XCircle };
    }
    if (!channel.isValidated) {
      return { status: 'pending', color: 'yellow', icon: AlertTriangle };
    }
    if (channel.validationError) {
      return { status: 'error', color: 'destructive', icon: XCircle };
    }
    return { status: 'active', color: 'green', icon: CheckCircle };
  };

  const getStatusText = (status: string) => {
    const statusMap = {
      'active': 'Activo',
      'inactive': 'Inactivo', 
      'pending': 'Pendiente',
      'error': 'Error'
    };
    return statusMap[status as keyof typeof statusMap] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin" />
        <span className="ml-2">Cargando canales...</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gestión de Credenciales</h1>
          <p className="text-muted-foreground">
            Configura tus credenciales para cada canal de distribución
          </p>
        </div>
        <Button onClick={() => setShowConfigForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Añadir Canal
        </Button>
      </div>

      {error && (
        <Alert className="mb-6" variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="configured" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="configured">Canales Configurados ({userChannels.length})</TabsTrigger>
          <TabsTrigger value="available">Canales Disponibles ({Object.keys(availableChannels).length})</TabsTrigger>
        </TabsList>

        <TabsContent value="configured" className="space-y-4">
          {userChannels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Settings className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No hay canales configurados</h3>
                <p className="text-muted-foreground text-center mb-4">
                  Configura tus credenciales para empezar a distribuir ofertas
                </p>
                <Button onClick={() => setShowConfigForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Configurar primer canal
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {userChannels.map((channel) => {
                const statusInfo = getChannelStatus(channel);
                const StatusIcon = statusInfo.icon;
                
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
                          {getStatusText(statusInfo.status)}
                        </Badge>
                      </div>
                      <CardDescription>
                        {availableChannels[channel.channelId]?.description || 'Canal de distribución'}
                      </CardDescription>
                    </CardHeader>
                    
                    <CardContent className="space-y-3">
                      {/* Límites configurados */}
                      {(channel.limits.dailyBudgetLimit || channel.limits.monthlyBudgetLimit || channel.limits.maxCPA) && (
                        <div className="text-sm space-y-1">
                          <p className="font-medium">Límites configurados:</p>
                          {channel.limits.dailyBudgetLimit && (
                            <p>• Presupuesto diario: €{channel.limits.dailyBudgetLimit}</p>
                          )}
                          {channel.limits.monthlyBudgetLimit && (
                            <p>• Presupuesto mensual: €{channel.limits.monthlyBudgetLimit}</p>
                          )}
                          {channel.limits.maxCPA && (
                            <p>• CPA máximo: €{channel.limits.maxCPA}</p>
                          )}
                        </div>
                      )}

                      {/* Error de validación si existe */}
                      {channel.validationError && (
                        <Alert variant="destructive" className="text-xs">
                          <AlertTriangle className="h-3 w-3" />
                          <AlertDescription>{channel.validationError}</AlertDescription>
                        </Alert>
                      )}

                      {/* Fecha de última validación */}
                      {channel.lastValidated && (
                        <p className="text-xs text-muted-foreground">
                          Validado: {new Date(channel.lastValidated).toLocaleDateString()}
                        </p>
                      )}

                      {/* Acciones */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleConfigureChannel(channel.channelId)}
                        >
                          <Settings className="h-3 w-3 mr-1" />
                          Editar
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleValidateCredentials(channel.channelId)}
                        >
                          <RefreshCw className="h-3 w-3 mr-1" />
                          Validar
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleDeleteCredentials(channel.channelId)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="available" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(availableChannels).map(([channelId, info]) => {
              const isConfigured = userChannels.some(c => c.channelId === channelId && c.isActive);
              
              return (
                <Card key={channelId} className={isConfigured ? "border-green-200 bg-green-50" : ""}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{info.name}</CardTitle>
                      {isConfigured && (
                        <Badge variant="secondary">Configurado</Badge>
                      )}
                    </div>
                    <CardDescription>{info.description}</CardDescription>
                  </CardHeader>
                  
                  <CardContent className="space-y-3">
                    <div className="text-sm">
                      <p><strong>Tipo:</strong> {info.type}</p>
                      <p><strong>Credenciales requeridas:</strong></p>
                      <ul className="list-disc list-inside text-xs text-muted-foreground ml-2">
                        {info.requiredCredentials.map(cred => (
                          <li key={cred}>{cred}</li>
                        ))}
                      </ul>
                    </div>
                    
                    <div className="text-xs text-muted-foreground border-t pt-2">
                      <p><strong>Instrucciones:</strong></p>
                      <p>{info.setupInstructions}</p>
                    </div>
                    
                    <Button
                      className="w-full"
                      variant={isConfigured ? "outline" : "default"}
                      onClick={() => handleConfigureChannel(channelId)}
                    >
                      {isConfigured ? (
                        <>
                          <Settings className="h-4 w-4 mr-2" />
                          Reconfigurar
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Configurar
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Formulario de configuración */}
      {showConfigForm && selectedChannel && availableChannels[selectedChannel] && (
        <ChannelConfigForm
          channelId={selectedChannel}
          channelInfo={availableChannels[selectedChannel]}
          existingCredentials={userChannels.find(ch => ch.channelId === selectedChannel)}
          userId={parseInt(user?.id || '0')}
          onSave={() => {
            setShowConfigForm(false);
            setSelectedChannel(null);
            loadUserChannels();
          }}
          onCancel={() => {
            setShowConfigForm(false);
            setSelectedChannel(null);
          }}
        />
      )}
    </div>
  );
}
