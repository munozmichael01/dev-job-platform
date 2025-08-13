# 📋 Guía Completa de Integraciones de Canales - Job Platform

## 📖 Índice

1. [Visión General del Sistema](#visión-general-del-sistema)
2. [Canales Integrados](#canales-integrados)
3. [Arquitectura Técnica](#arquitectura-técnica)
4. [Guía de Integración de Nuevos Canales](#guía-de-integración-de-nuevos-canales)
5. [Testing y Validación](#testing-y-validación)
6. [Troubleshooting](#troubleshooting)

---

## 🎯 Visión General del Sistema

### Objetivo
Plataforma multi-tenant para distribución automática e inteligente de ofertas de trabajo a múltiples canales externos, con tracking de performance y optimización basada en conversiones reales.

### Arquitectura General
```
Frontend (Next.js/TypeScript) ↔ Backend (Node.js/Express) ↔ Canales Externos
                                         ↕
                              Base de Datos (SQL Server)
```

### Características Clave
- **Multi-tenant**: Cada usuario maneja sus propias credenciales
- **Encriptación**: AES-256-GCM para credenciales sensibles
- **Distribución Inteligente**: Algoritmos de optimización automática
- **Tracking Completo**: Clicks, conversiones, ROI por canal
- **Escalabilidad**: Arquitectura preparada para growth comercial

---

## 🔗 Canales Integrados

### 1. 🟢 **Jooble** - Auction API (CPC)

#### **Descripción Funcional:**
Motor de búsqueda de empleo global con modelo de subasta CPC (Cost Per Click). Permite crear campañas con bids automáticos y manuales.

#### **Características:**
- **Modelo**: CPC (Cost Per Click)
- **CPA Promedio**: €15
- **Rango CPA**: €8 - €25
- **Países**: Global (ES, MX, US, GB, DE, FR, etc.)
- **Features**: Campaign management, bidding, performance analytics

#### **Implementación Técnica:**

**Backend - Servicio:**
```javascript
// backend/src/services/channels/joobleService.js
class JoobleService {
  // Métodos principales:
  createCampaign(campaignData, offers, budgetInfo)     // Crear campaña en Jooble
  pauseCampaign(campaignId)                            // Pausar campaña
  resumeCampaign(campaignId)                           // Reanudar campaña
  updateBids(campaignId, bidData)                      // Actualizar pujas
  getStatistics()                                      // Obtener métricas
}
```

**Credenciales Requeridas:**
```javascript
{
  apiKey: "string",        // API Key proporcionada por Jooble
  countryCode: "string",   // Código de país (es, mx, us, gb, etc.)
  timeout: "number"        // Timeout opcional (30000ms por defecto)
}
```

**Endpoints de Integración:**
```
POST /api/campaigns                    // Crear campaña con distribución Jooble
POST /api/channels/jooble/notifications // Webhooks de performance
```

**Flujo de Trabajo:**
1. Usuario configura credenciales Jooble
2. Crea campaña con distribución automática/manual
3. Sistema calcula presupuesto por canal
4. Se crea campaña en Jooble vía API
5. Jooble envía callbacks de performance
6. Sistema actualiza métricas y optimiza

---

### 2. 🟢 **Talent.com** - XML Feed (CPA)

#### **Descripción Funcional:**
Plataforma de reclutamiento que consume feeds XML de ofertas y envía aplicaciones vía webhook POST. Modelo CPA (Cost Per Application).

#### **Características:**
- **Modelo**: CPA (Cost Per Application)
- **CPA Promedio**: €18
- **Rango CPA**: €10 - €30
- **Países**: Global, especializado en US/CA/UK
- **Features**: XML publishing, application tracking, screening questions

#### **Implementación Técnica:**

**Backend - Servicio:**
```javascript
// backend/src/services/channels/talentService.js
class TalentService {
  // Métodos principales:
  publishOffers(offers, campaignData)                  // Generar feed XML
  processApplication(applicationData)                  // Procesar aplicación recibida
  generateScreeningQuestions(jobData)                  // Generar cuestionarios
}
```

**Credenciales Requeridas:**
```javascript
{
  publisherName: "string",    // Nombre empresa (aparece en Talent.com)
  publisherUrl: "string",     // URL principal del sitio web
  partnerEmail: "string",     // Email para aplicaciones backup
  feedUrl: "string",          // URL donde Talent accede al feed XML
  postbackUrl: "string"       // URL para recibir aplicaciones (opcional)
}
```

**Endpoints de Integración:**
```
GET  /api/channels/talent/feed/:userId     // Feed XML para Talent.com
POST /api/channels/talent/applications     // Recibir aplicaciones
```

**Flujo de Trabajo:**
1. Usuario configura credenciales Talent.com
2. Sistema genera feed XML público accesible
3. Talent.com rastrea el feed cada 24h
4. Usuarios aplican desde Talent.com
5. Aplicaciones llegan vía webhook POST
6. Sistema registra aplicación y actualiza métricas

---

### 3. 🟢 **JobRapido** - Feed XML/JSON + Webhooks

#### **Descripción Funcional:**
Agregador de ofertas con distribución orgánica. Soporta feeds XML/JSON y entrega CVs completos en Base64 vía webhooks.

#### **Características:**
- **Modelo**: Orgánico (sin costo directo)
- **CPA Promedio**: €12
- **Rango CPA**: €8 - €18
- **Países**: Europa, especializado en IT/ES
- **Features**: XML/JSON feeds, custom screening questions, CV Base64 delivery

#### **Implementación Técnica:**

**Backend - Servicio:**
```javascript
// backend/src/services/channels/jobRapidoService.js
class JobRapidoService {
  // Métodos principales:
  generateJobRapidoFeed(offers, format)               // Generar feed XML/JSON
  processJobRapidoApplication(applicationData)        // Procesar aplicación
  handleScreeningQuestions(questions)                 // Manejar cuestionarios
  mapJobRapidoFields(offer)                          // Mapeo de campos
}
```

**Credenciales Requeridas:**
```javascript
{
  partnerId: "string",         // ID de partner proporcionado por JobRapido
  partnerEmail: "string",      // Email de contacto
  partnerUsername: "string",   // Username del partner
  partnerPassword: "string",   // Password del partner
  webhookUrl: "string",        // URL para recibir aplicaciones
  feedFormat: "xml|json"       // Formato preferido del feed
}
```

**Endpoints de Integración:**
```
GET  /api/channels/jobrapido/feed/:userId/:format  // Feed XML/JSON
POST /api/channels/jobrapido/applications          // Recibir aplicaciones con CVs
```

**Flujo de Trabajo:**
1. Usuario configura credenciales JobRapido
2. Sistema genera feed en formato solicitado
3. JobRapido indexa ofertas orgánicamente
4. Usuarios aplican con CVs completos
5. Aplicación + CV Base64 llega vía webhook
6. Sistema procesa y almacena CV decodificado

---

### 4. 🟢 **WhatJobs** - XML Feed + S2S Tracking (CPC)

#### **Descripción Funcional:**
Motor de búsqueda global con optimización automática basada en S2S (Server-to-Server) tracking de conversiones reales.

#### **Características:**
- **Modelo**: CPC con optimización S2S
- **CPA Promedio**: €14
- **Rango CPA**: €8 - €20
- **Países**: Global (ES, MX, GB, US, DE, FR)
- **Features**: XML feed, S2S tracking, auto optimization, global reach

#### **Implementación Técnica:**

**Backend - Servicio:**
```javascript
// backend/src/services/channels/whatJobsService.js
class WhatJobsService {
  // Métodos principales:
  generateWhatJobsFeed(userId, offers, campaignConfig) // Generar feed XML
  processWhatJobsClick(wjClickID, authKey, offerId)    // Procesar click S2S
  reportConversion(wjClickID)                          // Reportar conversión S2S
  getPerformanceMetrics(userId, dateRange)            // Obtener métricas
  validateConfiguration()                              // Validar configuración
}
```

**Credenciales Requeridas:**
```javascript
{
  authKey: "string",      // Authentication Key de WhatJobs
  country: "string",      // País objetivo (ES, MX, GB, US, DE, FR)
  defaultCPC: "number",   // CPC por defecto (€2.50 recomendado)
  feedUrl: "string"       // URL generada automáticamente
}
```

**Endpoints de Integración:**
```
GET  /api/channels/whatjobs/feed/:userId        // Feed XML personalizado
GET  /api/channels/whatjobs/click               // S2S click tracking
POST /api/channels/whatjobs/click               // S2S click tracking (POST)
POST /api/channels/whatjobs/conversion          // S2S conversion tracking
```

**Flujo de Trabajo:**
1. Usuario configura credenciales WhatJobs
2. Sistema genera feed XML con tracking URLs
3. WhatJobs indexa ofertas con CPC optimizado
4. Usuario hace click → S2S tracking registra click
5. Usuario aplica → S2S tracking reporta conversión
6. WhatJobs optimiza automáticamente basado en conversiones

**S2S Tracking Flow:**
```
Click: GET /api/channels/whatjobs/click?wjClickID=X&authKey=Y
Conversion: POST /api/channels/whatjobs/conversion {wjClickID, applicantData}
WhatJobs Optimization: Automática basada en conversion data
```

---

### 5. 🟡 **InfoJobs** - API (CPA) - Pendiente

#### **Descripción Funcional:**
Portal de empleo líder en España. Integración vía API oficial para posting directo.

#### **Características:**
- **Modelo**: CPA (Cost Per Application)
- **CPA Promedio**: €20 (estimado)
- **Países**: España, Italia
- **Status**: Placeholder - Pendiente implementación

---

### 6. 🟡 **LinkedIn** - Job Postings API (CPC) - Pendiente

#### **Descripción Funcional:**
Red profesional con API de Job Postings para publicación directa y promoted jobs.

#### **Características:**
- **Modelo**: CPC (Cost Per Click)
- **CPA Promedio**: €25 (estimado)
- **Países**: Global, especializado en profesionales
- **Status**: Placeholder - Pendiente implementación

---

### 7. 🟡 **Indeed** - XML API (CPC) - Pendiente

#### **Descripción Funcional:**
Portal de empleo global con XML feeds y sponsored jobs.

#### **Características:**
- **Modelo**: CPC (Cost Per Click)
- **CPA Promedio**: €22 (estimado)
- **Países**: Global
- **Status**: Placeholder - Pendiente implementación

---

## 🏗️ Arquitectura Técnica

### Backend - Estructura de Archivos

```
backend/src/
├── services/
│   ├── channels/
│   │   ├── channelFactory.js           # Factory pattern para canales
│   │   ├── joobleService.js           # Servicio Jooble
│   │   ├── talentService.js           # Servicio Talent.com
│   │   ├── jobRapidoService.js        # Servicio JobRapido
│   │   └── whatJobsService.js         # Servicio WhatJobs
│   ├── campaignDistributionService.js  # Lógica de distribución
│   └── credentialsManager.js          # Gestión de credenciales encriptadas
├── routes/
│   ├── campaigns.js                   # APIs de campañas
│   ├── channelWebhooks.js            # Webhooks de canales
│   └── userCredentials.js            # APIs de credenciales de usuario
└── db/
    └── bootstrap.js                   # Esquemas de base de datos
```

### Frontend - Estructura de Archivos

```
frontend/
├── app/
│   ├── campanas/
│   │   ├── page.tsx                  # Lista de campañas
│   │   ├── nueva/page.tsx            # Crear campaña
│   │   ├── [id]/page.tsx             # Ver campaña
│   │   └── [id]/editar/page.tsx      # Editar campaña
│   └── credenciales/page.tsx         # Gestión de credenciales
└── components/
    ├── credentials/
    │   └── ChannelConfigForm.tsx     # Formularios por canal
    ├── campaigns/
    │   └── ChannelSelector.tsx       # Selector de canales
    └── dashboard/
        └── ChannelsDashboard.tsx     # Dashboard de canales
```

### Base de Datos - Esquemas Principales

```sql
-- Credenciales por usuario y canal
UserChannelCredentials (
    Id, UserId, ChannelId, ChannelName,
    EncryptedCredentials,              -- JSON encriptado con AES-256-GCM
    ConfigurationData,                 -- Configuración adicional
    DailyBudgetLimit, MonthlyBudgetLimit, MaxCPA,
    IsActive, IsValidated, ValidationError,
    CreatedAt, UpdatedAt
)

-- Tracking granular por campaña y canal
CampaignChannels (
    Id, CampaignId, ChannelId, OfferId,
    ExternalCampaignId,               -- ID en el canal externo
    AllocatedBudget, SpentBudget,
    TargetApplications, AchievedApplications,
    CurrentCPA, Status,
    CreatedAt, UpdatedAt
)

-- Aplicaciones recibidas de canales
Applications (
    Id, ChannelId, ExternalApplicationId,
    OfferId, ApplicantName, ApplicantEmail,
    ApplicationData,                  -- JSON con datos completos
    Converted, ConversionResponse,    -- Para S2S tracking
    ReceivedAt, ConvertedAt
)

-- Relación campañas-segmentos múltiples
CampaignSegments (
    Id, CampaignId, SegmentId,
    BudgetAllocation,                 -- Porcentaje del presupuesto
    Weight,                           -- Peso para distribución automática
    CreatedAt, UpdatedAt
)
```

### ChannelFactory - Patrón Factory

```javascript
class ChannelFactory {
  // Canales soportados
  supportedChannels = ['jooble', 'talent', 'jobrapido', 'whatjobs', 'infojobs', 'linkedin', 'indeed']
  
  // Obtener instancia de canal con credenciales de usuario
  async getChannel(channelId, config, userId)
  
  // Publicar en múltiples canales
  async publishToMultipleChannels(channelIds, offers, campaignData, userId)
  
  // Actualizar performance de múltiples canales
  async updatePerformanceStats(channelIds, offerIds)
  
  // Controlar campañas (pause/resume/delete)
  async controlMultipleChannelCampaigns(channelCampaigns, action)
}
```

---

## 🔧 Guía de Integración de Nuevos Canales

### Paso 1: Análisis del Canal

#### **1.1 Investigación Técnica**
- [ ] Documentación oficial del API/Feed
- [ ] Modelo de negocio (CPC, CPA, CPM, Orgánico)
- [ ] Formatos soportados (XML, JSON, API REST)
- [ ] Campos requeridos vs opcionales
- [ ] Límites de rate limiting
- [ ] Sistema de autenticación (API Key, OAuth, etc.)
- [ ] Webhooks/callbacks disponibles
- [ ] Países/mercados soportados

#### **1.2 Análisis de Valor**
- [ ] CPA/CPC promedio del canal
- [ ] Volumen de tráfico esperado
- [ ] Calidad de leads
- [ ] Diferenciación vs canales existentes
- [ ] Prioridad del cliente/mercado

#### **1.3 Definir Especificaciones**
```javascript
const newChannelSpec = {
  name: 'NuevoCanal',
  type: 'cpc|cpa|organic',
  cpaRange: { min: X, max: Y },
  defaultCPA: Z,
  supportedFormats: ['xml', 'json', 'api'],
  requiredCredentials: ['field1', 'field2'],
  optionalCredentials: ['field3', 'field4'],
  countries: ['ES', 'MX', 'US'],
  features: ['feature1', 'feature2']
}
```

### Paso 2: Implementación Backend

#### **2.1 Crear Servicio del Canal**

**Archivo:** `backend/src/services/channels/nuevoCanal Service.js`

```javascript
const sql = require('mssql');
const { pool, poolConnect } = require('../../db/db');

class NuevoCanalService {
  constructor(config = {}) {
    this.config = {
      // Configuración por defecto
      ...config
    };
    console.log(`🌐 ${this.constructor.name} initialized`);
  }

  // MÉTODO PRINCIPAL 1: Publicar ofertas
  async publishOffers(offers, campaignData) {
    try {
      console.log(`📤 Publicando ${offers.length} ofertas en NuevoCanal`);
      
      // Implementar lógica específica del canal
      // - Generar XML/JSON si es feed-based
      // - Llamar API si es API-based
      // - Manejar autenticación
      // - Procesar respuesta
      
      return {
        success: true,
        channel: 'nuevocanal',
        publishedOffers: offers.length,
        externalCampaignId: 'campaign-id-from-external-api'
      };
    } catch (error) {
      console.error(`❌ Error publicando en NuevoCanal: ${error.message}`);
      throw error;
    }
  }

  // MÉTODO PRINCIPAL 2: Procesar aplicaciones (si aplica)
  async processApplication(applicationData) {
    try {
      // Normalizar datos de aplicación
      return {
        applicant: {
          fullName: applicationData.name,
          email: applicationData.email,
          phoneNumber: applicationData.phone
        },
        job: {
          externalJobId: applicationData.jobId,
          title: applicationData.jobTitle,
          company: applicationData.company
        },
        channel: 'nuevocanal',
        applicationId: applicationData.applicationId,
        receivedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error(`❌ Error procesando aplicación NuevoCanal: ${error.message}`);
      throw error;
    }
  }

  // MÉTODO PRINCIPAL 3: Obtener métricas (si aplica)
  async getPerformanceMetrics(campaignId) {
    try {
      // Llamar API de métricas del canal
      return {
        channel: 'nuevocanal',
        campaignId: campaignId,
        impressions: 0,
        clicks: 0,
        applications: 0,
        spend: 0,
        cpa: 0
      };
    } catch (error) {
      console.error(`❌ Error obteniendo métricas NuevoCanal: ${error.message}`);
      throw error;
    }
  }

  // MÉTODO PRINCIPAL 4: Validar configuración
  async validateConfiguration() {
    try {
      console.log('🔍 Validando configuración NuevoCanal...');
      
      const errors = [];
      
      // Validar campos requeridos
      if (!this.config.requiredField1) {
        errors.push('requiredField1 es requerido');
      }
      
      if (errors.length > 0) {
        throw new Error(`Configuración inválida: ${errors.join(', ')}`);
      }
      
      // Test opcional de conectividad
      // await this.testConnection();
      
      console.log('✅ Configuración NuevoCanal válida');
      return { isValid: true, message: 'Configuración válida' };
      
    } catch (error) {
      console.error(`❌ Error validando NuevoCanal: ${error.message}`);
      return { isValid: false, error: error.message };
    }
  }

  // MÉTODOS AUXILIARES según necesidad del canal
  async pauseCampaign(campaignId) { /* implementar */ }
  async resumeCampaign(campaignId) { /* implementar */ }
  async updateBids(campaignId, bidData) { /* implementar */ }
  async generateFeed(offers, format) { /* implementar */ }
  async testConnection() { /* implementar */ }
}

module.exports = NuevoCanalService;
```

#### **2.2 Integrar en ChannelFactory**

**Archivo:** `backend/src/services/channels/channelFactory.js`

```javascript
// 1. Importar el servicio
const NuevoCanalService = require('./nuevoCanalService');

class ChannelFactory {
  constructor() {
    // 2. Agregar a canales soportados
    this.supportedChannels = ['jooble', 'talent', 'jobrapido', 'whatjobs', 'nuevocanal', ...];
  }

  async getChannel(channelId, config, userId) {
    switch (channelId.toLowerCase()) {
      // 3. Agregar case para nuevo canal
      case 'nuevocanal':
        channelService = new NuevoCanalService(finalConfig);
        break;
      // ... otros cases
    }
  }

  async publishToChannel(channelService, channelId, offers, campaignData) {
    switch (channelId.toLowerCase()) {
      // 4. Agregar lógica de publicación
      case 'nuevocanal':
        return await channelService.publishOffers(offers, campaignData);
      // ... otros cases
    }
  }

  calculateChannelBudget(campaignData, channelId) {
    const channelCPAs = {
      // 5. Agregar CPA estimado
      'nuevocanal': 16,
      // ... otros CPAs
    };
  }

  getChannelsInfo() {
    return {
      configurations: {
        // 6. Agregar información del canal
        nuevocanal: {
          type: 'api|xml_feed|json_feed',
          features: ['feature1', 'feature2'],
          costModel: 'cpc|cpa|organic',
          avgCPA: 16
        }
      }
    };
  }
}
```

#### **2.3 Agregar Webhooks (si aplica)**

**Archivo:** `backend/src/routes/channelWebhooks.js`

```javascript
/**
 * POST /api/channels/nuevocanal/applications
 * Endpoint para recibir aplicaciones desde NuevoCanal
 */
router.post('/nuevocanal/applications', logWebhook, async (req, res) => {
  try {
    console.log('📨 Aplicación recibida desde NuevoCanal');
    
    // Validar payload
    if (!req.body || !req.body.requiredField) {
      return respondWebhook(req, res, {
        success: false,
        error: 'Payload inválido: faltan campos obligatorios'
      });
    }
    
    // Procesar aplicación
    const NuevoCanalService = require('../services/channels/nuevoCanalService');
    const service = new NuevoCanalService();
    const processedApplication = service.processApplication(req.body);
    
    // Guardar en BD
    const savedApplication = await saveApplication(processedApplication);
    
    // Actualizar estadísticas
    await updateOfferStats(processedApplication.job.externalJobId, 'application');
    
    respondWebhook(req, res, {
      success: true,
      data: {
        applicationId: savedApplication.id,
        source: 'nuevocanal'
      }
    });
    
  } catch (error) {
    console.error(`❌ Error procesando aplicación NuevoCanal: ${error.message}`);
    respondWebhook(req, res, {
      success: false,
      error: error.message
    });
  }
});

// Agregar endpoint al status check
router.get('/webhook-status', (req, res) => {
  res.json({
    endpoints: {
      // ... otros endpoints
      nuevocanal_applications: '/api/channels/nuevocanal/applications'
    }
  });
});
```

#### **2.4 Configurar Credenciales**

**Archivo:** `backend/src/routes/userCredentials.js`

```javascript
// 1. Agregar a channelNames
const channelNames = {
  'nuevocanal': 'NuevoCanal',
  // ... otros canales
};

// 2. Agregar a información de canales
const channels = {
  nuevocanal: {
    name: 'NuevoCanal',
    type: 'CPC|CPA|Organic',
    description: 'Descripción del canal y su propuesta de valor',
    requiredCredentials: ['field1', 'field2'],
    optionalCredentials: ['field3', 'field4'],
    setupInstructions: 'Instrucciones específicas para obtener credenciales'
  }
};

// 3. Agregar validación de credenciales
function validateCredentials(channelId, credentials) {
  switch (channelId) {
    case 'nuevocanal':
      return credentials.field1 && credentials.field2;
    // ... otros cases
  }
}
```

#### **2.5 Actualizar Distribución**

**Archivo:** `backend/src/services/campaignDistributionService.js`

```javascript
const CHANNELS = {
  // Agregar definición del nuevo canal
  NUEVOCANAL: {
    id: 'nuevocanal',
    name: 'NuevoCanal',
    type: 'aggregator|portal|social',
    cpaRange: { min: 10, max: 25 },
    defaultCPA: 16,
    supportedFormats: ['xml', 'api']
  }
};
```

### Paso 3: Implementación Frontend

#### **3.1 Agregar Configuración en ChannelConfigForm**

**Archivo:** `frontend/components/credentials/ChannelConfigForm.tsx`

```typescript
// 1. Agregar icono
function getChannelIcon(channelId: string): string {
  const icons = {
    nuevocanal: '/icons/nuevocanal.png',
    // ... otros iconos
  };
}

// 2. Agregar placeholders
function getFieldPlaceholder(channelId: string, field: string): string {
  const placeholders: Record<string, Record<string, string>> = {
    nuevocanal: {
      field1: 'Valor ejemplo para field1',
      field2: 'Valor ejemplo para field2'
    }
  };
}

// 3. Agregar descripciones
function getFieldDescription(channelId: string, field: string): string {
  const descriptions: Record<string, Record<string, string>> = {
    nuevocanal: {
      field1: 'Descripción detallada del field1',
      field2: 'Descripción detallada del field2'
    }
  };
}

// 4. Agregar instrucciones de ayuda
function getHelpContent(channelId: string) {
  const helpContent: Record<string, React.ReactNode> = {
    nuevocanal: (
      <div className="space-y-3 text-sm">
        <h4 className="font-medium">Pasos para configurar NuevoCanal:</h4>
        <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
          <li>Paso 1 específico del canal</li>
          <li>Paso 2 específico del canal</li>
          <li>Paso 3 específico del canal</li>
        </ol>
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-xs text-blue-800">
            <strong>Ventaja única:</strong> Descripción del valor diferencial del canal
          </p>
        </div>
      </div>
    )
  };
}
```

#### **3.2 Actualizar Selector de Canales**

**Archivo:** `frontend/app/campanas/nueva/page.tsx`

```typescript
// Agregar nuevo canal a distribución automática
const channelsToUse = formData.distributionType === "manual" 
  ? formData.channels 
  : ["jooble", "talent", "jobrapido", "whatjobs", "nuevocanal"] // Todos los canales integrados
```

### Paso 4: Testing y Validación

#### **4.1 Crear Script de Pruebas**

**Archivo:** `backend/test-nuevocanal-integration.js`

```javascript
const NuevoCanalService = require('./src/services/channels/nuevoCanalService');
const ChannelFactory = require('./src/services/channels/channelFactory');

// Datos de prueba específicos del canal
const testConfig = {
  field1: 'test-value-1',
  field2: 'test-value-2'
};

const testOffers = [/* ofertas de prueba */];

async function testNuevoCanalService() {
  console.log('🧪 === TESTING NUEVOCANAL SERVICE ===\n');

  try {
    // Test 1: Inicialización
    const service = new NuevoCanalService(testConfig);
    console.log('✅ Servicio inicializado\n');

    // Test 2: Validación de configuración
    const validation = await service.validateConfiguration();
    console.log(`Validación: ${validation.isValid ? 'válida' : 'inválida'}\n`);

    // Test 3: Publicación de ofertas
    const result = await service.publishOffers(testOffers, {});
    console.log(`Publicación: ${result.success ? 'exitosa' : 'fallida'}\n`);

    // Test 4: Procesamiento de aplicaciones (si aplica)
    const appData = {/* datos de aplicación de prueba */};
    const processedApp = service.processApplication(appData);
    console.log('✅ Aplicación procesada\n');

  } catch (error) {
    console.error('❌ Error en pruebas:', error.message);
  }
}

async function testChannelFactory() {
  console.log('🧪 === TESTING CHANNEL FACTORY INTEGRATION ===\n');

  try {
    const factory = new ChannelFactory();
    
    // Verificar que el canal esté incluido
    const channelsInfo = factory.getChannelsInfo();
    const included = channelsInfo.supported.includes('nuevocanal');
    console.log(`Canal incluido: ${included ? 'SÍ' : 'NO'}\n`);

    // Crear instancia vía factory
    const service = await factory.getChannel('nuevocanal', testConfig);
    console.log('✅ Servicio creado vía Factory\n');

  } catch (error) {
    console.error('❌ Error en Factory:', error.message);
  }
}

// Ejecutar todas las pruebas
async function runAllTests() {
  await testNuevoCanalService();
  await testChannelFactory();
  console.log('🎉 PRUEBAS COMPLETADAS');
}

if (require.main === module) {
  runAllTests();
}
```

#### **4.2 Ejecutar Pruebas**

```bash
cd backend
node test-nuevocanal-integration.js
```

#### **4.3 Validar Frontend**

1. **Probar configuración de credenciales:**
   - Ir a `/credenciales`
   - Verificar que aparece NuevoCanal en "Canales Disponibles"
   - Configurar credenciales y validar

2. **Probar creación de campaña:**
   - Ir a `/campanas/nueva`
   - Crear campaña con distribución automática
   - Verificar que NuevoCanal está incluido

3. **Verificar dashboard:**
   - Comprobar que aparece en dashboard de canales
   - Validar métricas simuladas

### Paso 5: Documentación y Deployment

#### **5.1 Actualizar Documentación**

1. **Agregar a este documento** la especificación completa del nuevo canal
2. **Actualizar README** con instrucciones de configuración
3. **Crear documentación específica** del canal si es complejo

#### **5.2 Configurar Monitoreo**

```javascript
// Agregar logging específico
console.log(`📊 NuevoCanal metrics: ${metrics}`);
console.log(`🔔 NuevoCanal notification: ${notification}`);
```

#### **5.3 Crear Credenciales de Prueba**

```sql
-- Insertar credenciales de prueba para desarrollo
INSERT INTO UserChannelCredentials 
(UserId, ChannelId, ChannelName, EncryptedCredentials, IsActive, IsValidated)
VALUES 
(1, 'nuevocanal', 'NuevoCanal', [encrypted_test_credentials], 1, 1);
```

---

## 🧪 Testing y Validación

### Checklist de Testing por Canal

#### **✅ Funcionalidad Backend:**
- [ ] Servicio se inicializa correctamente
- [ ] Validación de configuración funciona
- [ ] Publicación de ofertas exitosa
- [ ] Procesamiento de aplicaciones (si aplica)
- [ ] Obtención de métricas (si aplica)
- [ ] Integración con ChannelFactory
- [ ] Webhooks responden correctamente

#### **✅ Funcionalidad Frontend:**
- [ ] Formulario de credenciales aparece
- [ ] Validación de campos funciona
- [ ] Guardado de credenciales exitoso
- [ ] Canal aparece en selector de campañas
- [ ] Dashboard muestra información del canal

#### **✅ Integración E2E:**
- [ ] Flujo completo: Credenciales → Campaña → Distribución
- [ ] Tracking de aplicaciones funciona
- [ ] Métricas se actualizan correctamente
- [ ] Error handling robusto

### Herramientas de Testing

#### **Unit Tests:**
```javascript
// Jest tests para servicios individuales
describe('NuevoCanalService', () => {
  test('should initialize correctly', () => {
    const service = new NuevoCanalService(testConfig);
    expect(service.config).toBeDefined();
  });

  test('should validate configuration', async () => {
    const service = new NuevoCanalService(testConfig);
    const result = await service.validateConfiguration();
    expect(result.isValid).toBe(true);
  });
});
```

#### **Integration Tests:**
```javascript
// Pruebas de integración con ChannelFactory
describe('ChannelFactory Integration', () => {
  test('should create channel service', async () => {
    const factory = new ChannelFactory();
    const service = await factory.getChannel('nuevocanal', testConfig);
    expect(service).toBeInstanceOf(NuevoCanalService);
  });
});
```

#### **API Tests:**
```javascript
// Pruebas de endpoints con Supertest
describe('Channel Webhooks', () => {
  test('POST /api/channels/nuevocanal/applications', async () => {
    const response = await request(app)
      .post('/api/channels/nuevocanal/applications')
      .send(testApplicationData)
      .expect(200);
    
    expect(response.body.success).toBe(true);
  });
});
```

---

## 🔧 Troubleshooting

### Problemas Comunes y Soluciones

#### **1. Error: Canal no soportado**
```
Error: Canal no soportado: nuevocanal. Canales disponibles: jooble, talent...
```
**Solución:**
- Verificar que el canal está en `supportedChannels` en `ChannelFactory`
- Verificar el case en `getChannel()` método

#### **2. Error: Credenciales inválidas**
```
Error: Configuración inválida: field1 es requerido
```
**Solución:**
- Verificar campos requeridos en `validateCredentials()`
- Verificar que el frontend envía todos los campos necesarios
- Verificar encriptación/desencriptación de credenciales

#### **3. Error: Cannot find module**
```
Cannot find module './nuevoCanalService'
```
**Solución:**
- Verificar que el archivo del servicio existe
- Verificar la importación en `ChannelFactory`
- Verificar nombre del archivo (case-sensitive en Linux)

#### **4. Error: Webhook no recibe datos**
```
Payload inválido: faltan campos obligatorios
```
**Solución:**
- Verificar estructura del payload esperado
- Verificar Content-Type del request (application/json)
- Agregar logging para debug del payload recibido

#### **5. Error: Base de datos**
```
Error: Cannot insert duplicate key in object 'UserChannelCredentials'
```
**Solución:**
- Verificar constraint único (UserId, ChannelId)
- Implementar UPDATE en lugar de INSERT para credenciales existentes

### Debugging Tips

#### **1. Logging Avanzado:**
```javascript
// Agregar logs detallados
console.log(`🔍 [${this.constructor.name}] Método: ${methodName}, Config: ${JSON.stringify(this.config)}`);
console.log(`📊 [${this.constructor.name}] Resultado: ${JSON.stringify(result)}`);
```

#### **2. Testing con Datos Reales:**
```javascript
// Crear sandbox de testing
const testMode = process.env.NODE_ENV === 'test';
if (testMode) {
  // Usar datos mockeados
} else {
  // Usar APIs reales
}
```

#### **3. Monitoreo de Performance:**
```javascript
// Medir tiempo de respuesta
const startTime = Date.now();
const result = await externalApiCall();
const duration = Date.now() - startTime;
console.log(`⏱️ API call duration: ${duration}ms`);
```

---

## 📈 Métricas y Monitoreo

### KPIs por Canal

#### **Métricas Técnicas:**
- **Uptime del canal**: % de tiempo disponible
- **Response time**: Tiempo promedio de respuesta de APIs
- **Error rate**: % de requests fallidos
- **Throughput**: Ofertas procesadas por hora

#### **Métricas de Negocio:**
- **CPA real vs estimado**: Eficiencia del canal
- **Conversion rate**: % de clicks que se convierten en aplicaciones
- **ROI**: Retorno de inversión por canal
- **Market share**: % del presupuesto asignado por canal

### Dashboard de Monitoreo

```javascript
// Métricas recolectadas automáticamente
const channelMetrics = {
  channelId: 'nuevocanal',
  period: '24h',
  offers_published: 1250,
  clicks_received: 3400,
  applications_received: 85,
  spend_total: 1250.50,
  cpa_average: 14.71,
  conversion_rate: 2.5,
  uptime_percentage: 99.8
};
```

---

## 🔮 Roadmap de Integración

### Prioridades Sugeridas

#### **🔥 Alta Prioridad:**
1. **Indeed** - Mayor volumen global, API estable
2. **InfoJobs** - Líder en España, mercado prioritario
3. **Glassdoor** - Diferenciación en employer branding

#### **🟡 Media Prioridad:**
4. **StepStone** - Presencia europea
5. **Monster** - Mercado establecido
6. **ZipRecruiter** - Innovación en matching

#### **🔵 Baja Prioridad:**
7. **SimplyHired** - Mercado saturado
8. **Adzuna** - Nicho específico
9. **Neuvoo** - Solapamiento con otros

### Criterios de Priorización

#### **Valor de Negocio:**
- Volumen de tráfico del canal
- Quality score de aplicaciones
- CPA competitivo
- Demanda del cliente

#### **Complejidad Técnica:**
- Calidad de documentación API
- Estabilidad del sistema
- Esfuerzo de implementación estimado
- Mantenimiento requerido

#### **Recursos Requeridos:**
- Tiempo de desarrollo estimado
- Necesidad de credenciales especiales
- Testing y QA requerido
- Soporte post-implementación

---

## 📚 Recursos Adicionales

### Documentación Oficial de Canales

#### **Integrados:**
- [Jooble API Documentation](https://jooble.org/api/about)
- [Talent.com Integration Guide](https://www.talent.com/integrations)
- [JobRapido Partner Documentation](https://jobrapido.com/partners)
- [WhatJobs S2S Integration](https://api.whatjobs.com/docs)

#### **Pendientes:**
- [InfoJobs API](https://developer.infojobs.net/)
- [LinkedIn Job Postings API](https://docs.microsoft.com/en-us/linkedin/talent/job-postings)
- [Indeed Publisher API](https://opensource.indeedeng.io/api-documentation/)

### Herramientas de Desarrollo

#### **Testing:**
- [Postman Collections](https://postman.com) - Para testing de APIs
- [Jest](https://jestjs.io/) - Unit testing framework
- [Supertest](https://github.com/visionmedia/supertest) - HTTP assertion testing

#### **Debugging:**
- [ngrok](https://ngrok.com/) - Para testing de webhooks localmente
- [Insomnia](https://insomnia.rest/) - Cliente REST avanzado
- [Wireshark](https://wireshark.org/) - Análisis de tráfico de red

### Best Practices

#### **Seguridad:**
- ✅ Encriptar todas las credenciales sensibles
- ✅ Validar todos los inputs de webhooks
- ✅ Implementar rate limiting
- ✅ Usar HTTPS para todos los endpoints
- ✅ Rotar credenciales periódicamente

#### **Performance:**
- ✅ Implementar caching donde sea apropiado
- ✅ Usar connection pooling para bases de datos
- ✅ Implementar retry logic con exponential backoff
- ✅ Monitorear métricas de performance
- ✅ Optimizar queries de base de datos

#### **Mantenibilidad:**
- ✅ Documentar todos los endpoints
- ✅ Usar logging estructurado
- ✅ Implementar health checks
- ✅ Versionado de APIs
- ✅ Testing automatizado completo

---

**📝 Documento creado el:** 2025-01-08  
**👤 Autor:** Claude AI Assistant  
**🔄 Última actualización:** 2025-01-08  
**📋 Versión:** 1.0  

---

*Este documento debe actualizarse cada vez que se integre un nuevo canal o se modifique la arquitectura existente.*
