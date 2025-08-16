"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Save, 
  X, 
  AlertTriangle, 
  CheckCircle, 
  Eye, 
  EyeOff,
  RefreshCw,
  HelpCircle
} from 'lucide-react';

interface ChannelConfigFormProps {
  channelId: string;
  channelInfo: {
    name: string;
    type: string;
    requiredCredentials: string[];
    optionalCredentials: string[];
    description: string;
    setupInstructions: string;
  };
  existingCredentials?: any;
  userId: number;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  credentials: Record<string, string>;
  limits: {
    dailyBudgetLimit: string;
    monthlyBudgetLimit: string;
    maxCPA: string;
  };
  configuration: {
    timezone: string;
    notifications: boolean;
  };
}

export default function ChannelConfigForm({ 
  channelId, 
  channelInfo, 
  existingCredentials,
  userId,
  onSave, 
  onCancel 
}: ChannelConfigFormProps) {
  const [formData, setFormData] = useState<FormData>({
    credentials: {},
    limits: {
      dailyBudgetLimit: '',
      monthlyBudgetLimit: '',
      maxCPA: ''
    },
    configuration: {
      timezone: 'Europe/Madrid',
      notifications: true
    }
  });

  const [showPasswords, setShowPasswords] = useState<Record<string, boolean>>({});
  const [loading, setSaving] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingExisting, setLoadingExisting] = useState(false);

  // Cargar datos existentes si estamos editando
  useEffect(() => {
    const loadExistingCredentials = async () => {
      if (!existingCredentials) return;
      
      setLoadingExisting(true);
      setError(null); // Limpiar errores anteriores
      setValidationResult(null); // Limpiar resultados de validación anteriores
      try {
        console.log('🔄 Cargando credenciales existentes para edición...');
        
        const response = await fetch(`http://localhost:3002/api/users/${userId}/credentials/${channelId}/details`);
        const data = await response.json();
        
        if (data.success) {
          console.log('✅ Credenciales cargadas:', data.data);
          
          setFormData({
            credentials: data.data.credentials || {},
            limits: {
              dailyBudgetLimit: data.data.limits?.dailyBudgetLimit || '',
              monthlyBudgetLimit: data.data.limits?.monthlyBudgetLimit || '',
              maxCPA: data.data.limits?.maxCPA || ''
            },
            configuration: {
              timezone: data.data.configuration?.timezone || 'Europe/Madrid',
              notifications: data.data.configuration?.notifications ?? true
            }
          });

          // Mostrar solo estado de validación exitosa anterior
          if (data.data.status?.isValidated && !data.data.status?.validationError) {
            setValidationResult({
              success: true,
              message: 'Credenciales validadas previamente',
              validation: {
                isValid: true,
                validatedAt: data.data.status.lastValidated
              }
            });
          }
          // No mostrar errores de validaciones anteriores automáticamente
        } else {
          console.error('❌ Error cargando credenciales:', data.error);
          setError('Error cargando credenciales existentes');
        }
      } catch (error) {
        console.error('❌ Error al cargar credenciales:', error);
        setError('Error conectando con el servidor');
      } finally {
        setLoadingExisting(false);
      }
    };

    loadExistingCredentials();
  }, [existingCredentials, userId, channelId]);

  const handleCredentialChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      credentials: {
        ...prev.credentials,
        [field]: value
      }
    }));
  };

  const handleLimitChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      limits: {
        ...prev.limits,
        [field]: value
      }
    }));
  };

  const togglePasswordVisibility = (field: string) => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const validateCredentials = async () => {
    setValidating(true);
    setValidationResult(null);
    setError(null);

    try {
      // Primero guardar las credenciales
      const saveResponse = await saveCredentials(false);
      if (!saveResponse) return;

      // Luego validar
      const response = await fetch(`http://localhost:3002/api/users/${userId}/credentials/${channelId}/validate`, {
        method: 'POST'
      });

      console.log('🔍 Response status:', response.status);
      console.log('🔍 Response headers:', response.headers);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP Error:', response.status, errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Validation response:', data);
      setValidationResult(data);

      if (!data.success) {
        setError(data.validation?.error || data.message || 'Error en validación');
      }
    } catch (error) {
      console.error('❌ Error validando credenciales:', error);
      setError(`Error validando ${channelInfo.name}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    } finally {
      setValidating(false);
    }
  };

  const saveCredentials = async (showSuccessMessage = true) => {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        credentials: formData.credentials,
        limits: {
          dailyBudgetLimit: formData.limits.dailyBudgetLimit ? parseFloat(formData.limits.dailyBudgetLimit) : null,
          monthlyBudgetLimit: formData.limits.monthlyBudgetLimit ? parseFloat(formData.limits.monthlyBudgetLimit) : null,
          maxCPA: formData.limits.maxCPA ? parseFloat(formData.limits.maxCPA) : null
        },
        configuration: formData.configuration
      };

      const response = await fetch(`http://localhost:3002/api/users/${userId}/credentials/${channelId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok) {
        if (showSuccessMessage) {
          setValidationResult({
            success: true,
            message: 'Credenciales guardadas exitosamente'
          });
          onSave();
        }
        return true;
      } else {
        setError(data.error || 'Error guardando credenciales');
        return false;
      }
    } catch (error) {
      console.error('Error guardando credenciales:', error);
      setError('Error guardando credenciales');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const renderCredentialField = (field: string, isRequired = false) => {
    const isPassword = field.toLowerCase().includes('password') || 
                      field.toLowerCase().includes('secret') || 
                      field.toLowerCase().includes('key');
    const fieldType = isPassword && !showPasswords[field] ? 'password' : 'text';

    return (
      <div key={field} className="space-y-2">
        <Label htmlFor={field} className="flex items-center gap-2">
          {field}
          {isRequired && <Badge variant="destructive" className="text-xs">Requerido</Badge>}
        </Label>
        <div className="relative">
          <Input
            id={field}
            type={fieldType}
            value={formData.credentials[field] || ''}
            onChange={(e) => handleCredentialChange(field, e.target.value)}
            placeholder={getFieldPlaceholder(channelId, field)}
            className={isRequired && !formData.credentials[field] ? 'border-red-300' : ''}
          />
          {isPassword && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3"
              onClick={() => togglePasswordVisibility(field)}
            >
              {showPasswords[field] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          )}
        </div>
        {getFieldDescription(channelId, field) && (
          <p className="text-xs text-muted-foreground">
            {getFieldDescription(channelId, field)}
          </p>
        )}
      </div>
    );
  };

  const isFormValid = () => {
    return channelInfo.requiredCredentials.every(field => 
      formData.credentials[field] && formData.credentials[field].trim() !== ''
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <Card className="w-full max-w-4xl m-4 max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <img 
                  src={getChannelIcon(channelId)} 
                  alt={channelInfo.name}
                  className="w-6 h-6"
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                Configurar {channelInfo.name}
              </CardTitle>
              <CardDescription>{channelInfo.description}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={onCancel}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {loadingExisting && (
            <Alert>
              <RefreshCw className="h-4 w-4 animate-spin" />
              <AlertDescription>Cargando credenciales existentes...</AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {validationResult && (
            <Alert variant={validationResult.success ? "default" : "destructive"}>
              {validationResult.success ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
              <AlertDescription>{validationResult.message}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="credentials" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="credentials">Credenciales</TabsTrigger>
              <TabsTrigger value="limits">Límites</TabsTrigger>
              <TabsTrigger value="help">Ayuda</TabsTrigger>
            </TabsList>

            <TabsContent value="credentials" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {/* Campos requeridos */}
                <div className="space-y-4">
                  <h4 className="font-medium text-sm text-green-700">Campos Requeridos</h4>
                  {channelInfo.requiredCredentials.map(field => 
                    renderCredentialField(field, true)
                  )}
                </div>

                {/* Campos opcionales */}
                {channelInfo.optionalCredentials.length > 0 && (
                  <div className="space-y-4">
                    <h4 className="font-medium text-sm text-gray-600">Campos Opcionales</h4>
                    {channelInfo.optionalCredentials.map(field => 
                      renderCredentialField(field, false)
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={validateCredentials}
                  disabled={!isFormValid() || validating}
                  variant="outline"
                >
                  {validating ? (
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4 mr-2" />
                  )}
                  Probar Conexión
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="limits" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="dailyBudget">Presupuesto Diario Límite (€)</Label>
                  <Input
                    id="dailyBudget"
                    type="number"
                    step="0.01"
                    value={formData.limits.dailyBudgetLimit}
                    onChange={(e) => handleLimitChange('dailyBudgetLimit', e.target.value)}
                    placeholder="ej: 100.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Límite máximo de gasto diario en este canal
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="monthlyBudget">Presupuesto Mensual Límite (€)</Label>
                  <Input
                    id="monthlyBudget"
                    type="number"
                    step="0.01"
                    value={formData.limits.monthlyBudgetLimit}
                    onChange={(e) => handleLimitChange('monthlyBudgetLimit', e.target.value)}
                    placeholder="ej: 2000.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Límite máximo de gasto mensual en este canal
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxCPA">CPA Máximo (€)</Label>
                  <Input
                    id="maxCPA"
                    type="number"
                    step="0.01"
                    value={formData.limits.maxCPA}
                    onChange={(e) => handleLimitChange('maxCPA', e.target.value)}
                    placeholder="ej: 25.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    Costo por aplicación máximo permitido
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Zona Horaria</Label>
                  <Select
                    value={formData.configuration.timezone}
                    onValueChange={(value) => setFormData(prev => ({
                      ...prev,
                      configuration: { ...prev.configuration, timezone: value }
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Europe/Madrid">Europa/Madrid</SelectItem>
                      <SelectItem value="Europe/London">Europa/Londres</SelectItem>
                      <SelectItem value="America/New_York">América/Nueva York</SelectItem>
                      <SelectItem value="Asia/Tokyo">Asia/Tokio</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="help" className="space-y-4">
              <Alert>
                <HelpCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Instrucciones de configuración para {channelInfo.name}:</strong>
                  <br />
                  {channelInfo.setupInstructions}
                </AlertDescription>
              </Alert>

              {renderChannelSpecificHelp(channelId)}
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-2 pt-6 border-t">
            <Button variant="outline" onClick={onCancel}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveCredentials()}
              disabled={!isFormValid() || loading}
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Guardar Credenciales
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Funciones auxiliares

function getChannelIcon(channelId: string): string {
  const icons = {
    jooble: '/icons/jooble.png',
    talent: '/icons/talent.png',
    jobrapido: '/icons/jobrapido.png',
    whatjobs: '/icons/whatjobs.png',
    infojobs: '/icons/infojobs.png',
    linkedin: '/icons/linkedin.png',
    indeed: '/icons/indeed.png'
  };
  return icons[channelId as keyof typeof icons] || '/icons/default-channel.png';
}

function getFieldPlaceholder(channelId: string, field: string): string {
  const placeholders: Record<string, Record<string, string>> = {
    jooble: {
      apiKey: 'XXXXX-XXXX-XXXX-XXXXX-XXXXXXXX',
      countryCode: 'es,fr,de',
      timeout: '30000'
    },
    talent: {
      publisherName: 'Mi Empresa S.L.',
      publisherUrl: 'https://miempresa.com',
      partnerEmail: 'jobs@miempresa.com',
      feedUrl: 'https://miempresa.com/talent-feed.xml',
      postbackUrl: 'https://miempresa.com/webhook/talent'
    },
    jobrapido: {
      partnerId: 'mi-partner-id',
      partnerEmail: 'jobs@miempresa.com',
      partnerUsername: 'mi-username',
      partnerPassword: '••••••••',
      webhookUrl: 'https://miempresa.com/webhook/jobrapido',
      feedFormat: 'xml'
    },
    whatjobs: {
      authKey: '71ca00e950a5054cac5afc0cb89abcb3',
      country: 'ES',
      defaultCPC: '2.50',
      feedUrl: 'https://miempresa.com/whatjobs-feed.xml'
    },
    infojobs: {
      apiKey: 'tu-api-key-infojobs',
      clientId: 'tu-client-id',
      secret: '••••••••'
    },
    linkedin: {
      clientId: 'tu-linkedin-client-id',
      clientSecret: '••••••••',
      accessToken: 'tu-access-token',
      organizationId: 'tu-organization-id'
    },
    indeed: {
      publisherId: 'tu-publisher-id',
      apiKey: 'tu-indeed-api-key'
    }
  };

  return placeholders[channelId]?.[field] || `Introduce ${field}`;
}

function getFieldDescription(channelId: string, field: string): string {
  const descriptions: Record<string, Record<string, string>> = {
    jooble: {
      apiKey: 'Clave API única proporcionada por tu manager de Jooble',
      countryCode: 'Códigos de país separados por comas (es,fr,de,uk,etc.)',
      timeout: 'Timeout en milisegundos para peticiones API'
    },
    talent: {
      publisherName: 'Nombre de tu empresa tal como aparecerá en Talent.com',
      publisherUrl: 'URL principal de tu sitio web',
      partnerEmail: 'Email donde recibirás aplicaciones como backup',
      feedUrl: 'URL donde Talent.com accederá a tu feed XML',
      postbackUrl: 'URL donde recibirás aplicaciones vía webhook'
    },
    jobrapido: {
      partnerId: 'ID de partner proporcionado por JobRapido',
      partnerEmail: 'Email de contacto para aplicaciones',
      webhookUrl: 'URL donde recibirás aplicaciones',
      feedFormat: 'Formato del feed: xml o json'
    },
    whatjobs: {
      authKey: 'Clave de autenticación proporcionada por WhatJobs',
      country: 'Código de país objetivo (ES, MX, GB, US, DE, FR)',
      defaultCPC: 'CPC por defecto en euros/dolares',
      feedUrl: 'URL generada automáticamente para tu feed XML'
    }
  };

  return descriptions[channelId]?.[field] || '';
}

function renderChannelSpecificHelp(channelId: string) {
  const helpContent: Record<string, JSX.Element> = {
    jooble: (
      <div className="space-y-3 text-sm">
        <h4 className="font-medium">Pasos para configurar Jooble:</h4>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Contacta a tu manager dedicado de Jooble</li>
          <li>Solicita una clave API única para tu cuenta</li>
          <li>Especifica el código de país donde quieres publicar</li>
          <li>Configura tu presupuesto y límites de CPA</li>
        </ol>
      </div>
    ),
    talent: (
      <div className="space-y-3 text-sm">
        <h4 className="font-medium">Pasos para configurar Talent.com:</h4>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Regístrate como publisher en Talent.com</li>
          <li>Configura tu feed XML público</li>
          <li>Establece un endpoint para recibir aplicaciones</li>
          <li>Opcionalmente configura screening questions</li>
        </ol>
      </div>
    ),
    jobrapido: (
      <div className="space-y-3 text-sm">
        <h4 className="font-medium">Pasos para configurar JobRapido:</h4>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Solicita credenciales de partner a JobRapido</li>
          <li>Configura tu webhook para recibir aplicaciones</li>
          <li>Elige formato de feed (XML o JSON)</li>
          <li>Configura screening questions personalizadas</li>
        </ol>
      </div>
    ),
    whatjobs: (
      <div className="space-y-3 text-sm">
        <h4 className="font-medium">Pasos para configurar WhatJobs:</h4>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Contacta a WhatJobs para obtener tu Authentication Key</li>
          <li>Selecciona el país objetivo para tus ofertas</li>
          <li>Configura tu CPC por defecto según tu presupuesto</li>
          <li>El feed XML se generará automáticamente</li>
          <li>Las conversiones se trackearán via S2S automáticamente</li>
        </ol>
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-800">
            <strong>Ventaja única:</strong> WhatJobs optimiza automáticamente tus campañas 
            basándose en las conversiones reales que reportamos via S2S tracking.
          </p>
        </div>
      </div>
    )
  };

  return helpContent[channelId] || (
    <div className="text-sm text-muted-foreground">
      <p>Contacta al soporte del canal para obtener instrucciones específicas de configuración.</p>
    </div>
  );
}
