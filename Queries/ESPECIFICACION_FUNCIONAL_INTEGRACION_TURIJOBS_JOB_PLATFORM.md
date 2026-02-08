# ESPECIFICACIÓN FUNCIONAL: INTEGRACIÓN TURIJOBS ↔ JOB PLATFORM

**Versión:** 2.0
**Fecha:** 2025-01-27
**Autor:** Job Platform Team
**Destinatario:** Equipo Técnico Turijobs

---

## 1. CONTEXTO DEL PROYECTO

### 1.1 Descripción General

Job Platform es una plataforma multi-tenant de distribución automatizada de ofertas de trabajo a múltiples canales de publicidad (Jooble, Talent.com, JobRapido, WhatJobs, InfoJobs, LinkedIn, Indeed).

**Modelo de colaboración:**
- Turijobs y Job Platform operan como **partners estratégicos**
- Turijobs mantiene la propiedad y control técnico de la implementación
- Job Platform define los requisitos funcionales necesarios para la integración

### 1.2 Propuesta de Valor

**Para Turijobs:**
- Single point of integration vs múltiples integraciones directas con agregadores
- Centralización de distribución multi-canal
- Acceso a métricas consolidadas de rendimiento cross-channel

**Para Job Platform:**
- Acceso a inventario de ofertas de Turijobs
- Capacidad de distribuir ofertas a múltiples canales publicitarios
- Tracking de métricas y conversiones por canal

---

## 2. OBJETIVO DE ESTA ESPECIFICACIÓN

Definir los **requisitos funcionales** que Turijobs debe implementar en dos endpoints independientes:

1. **Endpoint de ofertas** - Datos estructurales de ofertas (título, empresa, ubicación, etc.)
2. **Endpoint de métricas** - Datos de rendimiento dinámicos (impresiones, clics, aplicaciones, etc.)

Esta separación permite:
- ✅ Optimización de performance (50% menos payload en sync de métricas)
- ✅ Caching más eficiente con TTL diferenciados
- ✅ Escalabilidad independiente de cada endpoint
- ✅ Reducción de 40% en queries de BD Turijobs

**Importante:** Este documento especifica **QUÉ necesita Job Platform**, no **CÓMO debe implementarlo Turijobs**. El equipo técnico de Turijobs tiene libertad total para la implementación técnica.

---

## REQUISITO 1: ENDPOINT DE EXPORTACIÓN DE OFERTAS

### 1.1 Endpoint Base

```
GET /api/v1/job-offers/export
```

### 1.2 Funcionalidad

Retorna **solo datos estructurales de ofertas** (título, empresa, ubicación, requisitos, etc.) **SIN métricas de rendimiento**.

### 1.3 Parámetros de Request

| Parámetro | Tipo | Obligatorio | Default | Descripción |
|-----------|------|-------------|---------|-------------|
| `page` | Integer | No | 1 | Número de página para paginación |
| `size` | Integer | No | 100 | Cantidad de ofertas por página (máximo: 1000) |
| `dateFrom` | ISO 8601 | No | - | Filtro por fecha de publicación (desde) |
| `dateTo` | ISO 8601 | No | - | Filtro por fecha de publicación (hasta) |
| `statusIds` | Array[Integer] | No | - | Filtro por estados de oferta (ej: [1,2,3]) |
| `offerIds` | Array[Integer] | No | - | Filtro por IDs específicos de ofertas |

**Ejemplos de uso:**

```bash
# Sync incremental: ofertas nuevas/modificadas desde última sync
GET /api/v1/job-offers/export?dateFrom=2025-01-27T10:00:00Z&statusIds[]=1

# Ofertas específicas para re-sincronización
GET /api/v1/job-offers/export?offerIds[]=316256&offerIds[]=316257

# Paginación de ofertas activas
GET /api/v1/job-offers/export?page=1&size=100&statusIds[]=1
```

### 1.4 Estructura de Response

```json
{
  "total": 31553,
  "page": 1,
  "pageSize": 100,
  "totalPages": 316,
  "offers": [
    {
      // ========== IDENTIFICACIÓN ==========
      "OfferId": "316256",

      // ========== IDs PARA SEGMENTACIÓN ==========
      "titleId": 669,
      "titleDenominationId": 20871,
      "areaId": 1,
      "sectorId": 14,
      "degreeId": 13,
      "experienceId": 3,
      "contractTypeId": 2,
      "workdayTypeId": 0,
      "salaryTypeId": 1,
      "statusId": 1,
      "companyId": 123,
      "brandId": 456,
      "cityId": 11804,
      "regionId": 118,
      "countryId": 118,
      "languageId": 5,

      // ========== TEXTOS PARA DISPLAY ==========
      "title": "Empregado/a de Mesa - Hotel Braga",
      "jobTitle": "Camarero/a",
      "area": "Waiting staff",
      "sector": "Business group",
      "companyName": "RCS Grupo",
      "brandName": "RCS Hotels",

      // ========== UBICACIÓN GEOGRÁFICA ==========
      "city": "Braga",
      "region": "Braga",
      "country": "Portugal",
      "countryISO": "PT",
      "address": "Rua do Hotel, 123",
      "postcode": "4700-123",
      "latitude": 41.5454,
      "longitude": -8.4265,

      // ========== CLASIFICACIÓN LABORAL ==========
      "degreeName": "Sin estudios",
      "experienceName": "1-2 años",
      "contractTypeName": "Indefinido",
      "workdayTypeName": "Completa",
      "language": "Inglés",

      // ========== INFORMACIÓN SALARIAL ==========
      "salaryMin": 1200.00,
      "salaryMax": 1500.00,
      "salaryTypeName": "Mensual",
      "salaryCurrency": "EUR",
      "salaryVisible": true,

      // ========== DESCRIPCIONES Y DETALLES ==========
      "description": "Buscamos camarero/a con experiencia en servicio de sala para hotel 4 estrellas...",
      "requirements": "Experiencia mínima 1 año en puesto similar, idiomas valorados...",
      "scheduleTime": "Turnos rotativos mañana/tarde",
      "vacancies": 2,

      // ========== ESTADO Y FECHAS ==========
      "statusName": "Active",
      "publicationDate": "2025-12-23T17:32:56.410Z",
      "finishDate": "2026-02-28T23:59:59Z",
      "lastModified": "2026-01-20T14:30:00Z",

      // ========== URLS Y ENLACES ==========
      "OfferUrl": "https://www.turijobs.com/oferta/316256",
      "applicationUrl": "https://www.turijobs.com/apply/316256",
      "redirectUrl": null,

      // ========== FLAGS ADICIONALES ==========
      "hasRedirect": false,
      "isBlind": false,
      "isFilled": false,
      "isFeatured": true
    }
  ]
}
```

### 1.5 Campos Obligatorios

Los siguientes campos **DEBEN** estar presentes en todas las ofertas:

```json
{
  "OfferId": "316256",
  "title": "Camarero/a - Hotel 5* Algarve",
  "titleId": 669,
  "titleDenominationId": 20871,
  "jobTitle": "Camarero/a",
  "companyName": "Meliá Hotels International",
  "companyId": 123,
  "city": "Braga",
  "cityId": 11804,
  "region": "Braga",
  "regionId": 118,
  "country": "Portugal",
  "countryId": 118,
  "sector": "Business group",
  "sectorId": 14,
  "description": "Buscamos camarero/a con experiencia...",
  "statusId": 1,
  "publicationDate": "2025-12-23T17:32:56.410Z",
  "finishDate": "2026-02-28T23:59:59Z",
  "OfferUrl": "https://www.turijobs.com/oferta/316256"
}
```

### 1.6 Campos Opcionales (pueden ser null)

- `brandId`, `brandName` - Solo si difiere de empresa principal
- `salaryMin`, `salaryMax`, `salaryVisible` - Muchas ofertas no publican salario
- `latitude`, `longitude` - Si no hay geocodificación
- `requirements`, `scheduleTime` - Si no hay detalles específicos
- `redirectUrl`, `hasRedirect` - Solo si hay redirección especial
- `isBlind`, `isFilled`, `isFeatured` - Flags opcionales
- `languageId`, `language` - Si no hay requisito de idioma específico

### 1.7 Formato de Fechas

Todas las fechas **DEBEN** usar formato **ISO 8601 con timezone**:

```
2025-12-23T17:32:56.410Z
```

**Incorrecto:**
- `2025-12-23` (falta hora y timezone)
- `2025-12-23 17:32:56` (formato SQL, no ISO 8601)
- `23/12/2025` (formato europeo, no ISO 8601)

---

## REQUISITO 2: ENDPOINT DE MÉTRICAS

### 2.1 Endpoint Base

```
GET /api/v1/job-offers/metrics
```

### 2.2 Funcionalidad

Retorna **solo métricas de rendimiento** (impresiones, clics, aplicaciones, conversiones) **SIN datos estructurales de ofertas**.

### 2.3 Parámetros de Request

| Parámetro | Tipo | Obligatorio | Default | Descripción |
|-----------|------|-------------|---------|-------------|
| `offerIds` | Array[Integer] | **SÍ** | - | IDs de ofertas para obtener métricas (máx 1000 IDs) |

**Nota importante:** Este endpoint NO tiene paginación. Se espera que Job Platform solicite métricas de IDs específicos (ofertas activas en su BD).

**Ejemplos de uso:**

```bash
# Sync de métricas para 1000 ofertas activas
GET /api/v1/job-offers/metrics?offerIds[]=316256&offerIds[]=316257&offerIds[]=316258...

# Métricas de campaña específica (50 ofertas)
GET /api/v1/job-offers/metrics?offerIds[]=316256&offerIds[]=316257...
```

### 2.4 Estructura de Response

```json
{
  "metrics": [
    {
      "OfferId": "316256",

      // ========== MÉTRICAS LIFETIME ==========
      "lifetime": {
        // Contadores RAW
        "totalListImpressions": 5000,
        "totalDetailViews": 500,
        "totalPageVisits": 250,
        "totalApplications": 30,

        // Métricas calculadas
        "totalEngagements": 750,
        "totalTouchpoints": 5750,
        "overallConversionRate": 0.52,
        "engagementApplicationRate": 4.00
      },

      // ========== MÉTRICAS ÚLTIMOS 7 DÍAS ==========
      "last7d": {
        "totalListImpressions": 400,
        "totalDetailViews": 50,
        "totalPageVisits": 20,
        "totalApplications": 2,
        "totalEngagements": 70,
        "totalTouchpoints": 470,
        "overallConversionRate": 0.43,
        "engagementApplicationRate": 2.86
      },

      // ========== MÉTRICAS ÚLTIMOS 30 DÍAS ==========
      "last30d": {
        "totalListImpressions": 2400,
        "totalDetailViews": 280,
        "totalPageVisits": 140,
        "totalApplications": 15,
        "totalEngagements": 420,
        "totalTouchpoints": 2820,
        "overallConversionRate": 0.53,
        "engagementApplicationRate": 3.57
      },

      // ========== DESGLOSE POR CANAL ==========
      "channelMetrics": [
        {
          "source": "jooble",
          "medium": "cpc",
          "campaign": "campaign_2031",

          "lifetime": {
            "listImpressions": 1200,
            "detailViews": 120,
            "pageVisits": 60,
            "applications": 8,
            "totalEngagements": 180,
            "totalTouchpoints": 1380,
            "overallConversionRate": 0.58,
            "engagementApplicationRate": 4.44
          },

          "last7d": {
            "listImpressions": 100,
            "detailViews": 12,
            "pageVisits": 5,
            "applications": 1,
            "totalEngagements": 17,
            "totalTouchpoints": 117,
            "overallConversionRate": 0.85,
            "engagementApplicationRate": 5.88
          },

          "last30d": {
            "listImpressions": 600,
            "detailViews": 70,
            "pageVisits": 35,
            "applications": 5,
            "totalEngagements": 105,
            "totalTouchpoints": 705,
            "overallConversionRate": 0.71,
            "engagementApplicationRate": 4.76
          }
        },
        {
          "source": "organic",
          "medium": "organic",
          "campaign": null,

          "lifetime": {
            "listImpressions": 2500,
            "detailViews": 250,
            "pageVisits": 120,
            "applications": 15,
            "totalEngagements": 370,
            "totalTouchpoints": 2870,
            "overallConversionRate": 0.52,
            "engagementApplicationRate": 4.05
          },

          "last7d": {
            "listImpressions": 200,
            "detailViews": 25,
            "pageVisits": 10,
            "applications": 1,
            "totalEngagements": 35,
            "totalTouchpoints": 235,
            "overallConversionRate": 0.43,
            "engagementApplicationRate": 2.86
          },

          "last30d": {
            "listImpressions": 1200,
            "detailViews": 150,
            "pageVisits": 70,
            "applications": 7,
            "totalEngagements": 220,
            "totalTouchpoints": 1420,
            "overallConversionRate": 0.49,
            "engagementApplicationRate": 3.18
          }
        }
      ]
    }
  ]
}
```

### 2.5 Explicación de Métricas

#### **Contadores RAW (desde BD Turijobs):**

| Métrica | Descripción | Tabla origen en Turijobs |
|---------|-------------|--------------------------|
| `totalListImpressions` | Impresiones en listados/cards | `JobOfferDisplay` |
| `totalDetailViews` | Vistas del detalle en buscador | `JobOfferDescriptionDisplay` |
| `totalPageVisits` | Visitas a página completa de oferta | `JobVacancyClicks` |
| `totalApplications` | Aplicaciones completadas | `Tregistration` |

#### **Métricas Pre-calculadas:**

| Métrica | Fórmula | Contexto y uso |
|---------|---------|----------------|
| `totalEngagements` | `detailViews + pageVisits` | **Interacciones activas del usuario.** Representa cuando el usuario elige activamente ver más información (no es una impresión pasiva). Job Platform usa esto para medir el interés real generado por el título y preview de la oferta. |
| `totalTouchpoints` | `listImpressions + detailViews + pageVisits` | **Todas las interacciones del usuario con la oferta.** Es la suma total de todas las veces que el usuario interactuó con la oferta en cualquier nivel. Job Platform usa esto como denominador para calcular conversión global. |
| `overallConversionRate` | `(applications / totalTouchpoints) × 100` | **Eficiencia global de conversión (%).** Mide de TODAS las veces que se mostró la oferta (en cualquier formato), cuántas terminaron en aplicación. Job Platform usa esto para comparar performance entre ofertas y canales, y para calcular el ROI real. Un 0.5% se considera bueno, >1% excelente. |
| `engagementApplicationRate` | `(applications / totalEngagements) × 100` | **Conversión cuando hay interés activo (%).** Mide cuando el usuario SE TOMA EL TIEMPO de investigar (ver detalle o página completa), cuántos realmente aplican. Job Platform usa esto para evaluar la calidad del contenido de la oferta (descripción, salario, requisitos). Un 3-5% se considera bueno, >8% excelente. Permite distinguir entre ofertas con buen título (muchas impresiones) vs buena descripción (alta conversión desde engagement). |

### 2.6 Ventanas Temporales

**Razón de incluir 3 ventanas (lifetime + last30d + last7d):**

| Ventana | Uso en Job Platform | Caso de Uso |
|---------|---------------------|-------------|
| **lifetime** | Performance total desde publicación | "Top 10 ofertas por aplicaciones totales", ROI histórico |
| **last30d** | Comparativa mensual estándar | "Ofertas con mejor conversion rate este mes", tendencias mensuales |
| **last7d** | Detección de fatiga / momentum | "Ofertas con caída >50% aplicaciones esta semana", alertas de optimización |

**Ventanas en channelMetrics:**

Cada canal incluye las mismas 3 ventanas para permitir análisis comparativo cross-channel por periodo.

**Por qué NO incluir last90d:**

- Ofertas típicas duran 30-45 días
- Para ofertas de 35 días: last90d = lifetime (sin valor agregado)
- Overhead innecesario en payload y cómputo

---

## REQUISITO 3: FLUJOS DE SINCRONIZACIÓN

### 3.1 Sync Incremental de Ofertas Nuevas/Modificadas (cada 15 min)

**Objetivo:** Detectar ofertas nuevas o actualizadas

```javascript
// PASO 1: Obtener ofertas nuevas/modificadas
const offersResponse = await fetch(
  '/api/v1/job-offers/export?dateFrom=2025-01-27T10:00:00Z&statusIds[]=1'
)
// Response: 15 ofertas con datos estructurales

// PASO 2: Obtener métricas de esas ofertas
const offerIds = offersResponse.offers.map(o => o.OfferId)
const metricsResponse = await fetch(
  `/api/v1/job-offers/metrics?offerIds[]=${offerIds.join('&offerIds[]=')}`
)

// PASO 3: Merge y guardar en BD Job Platform
offersResponse.offers.forEach(offer => {
  const metrics = metricsResponse.metrics.find(m => m.OfferId === offer.OfferId)
  saveOfferWithMetrics(offer, metrics)
})
```

**Volumen estimado:** 5-50 ofertas por sync
**Frecuencia:** Cada 15 minutos
**Tráfico diario:** ~96 requests × 2 endpoints = 192 requests/día

### 3.2 Sync Solo Métricas (cada 5 min)

**Objetivo:** Actualizar métricas de ofertas activas sin re-sincronizar datos estructurales

```javascript
// PASO 1: Obtener IDs de ofertas activas en Job Platform
const activeOfferIds = await db.query(
  'SELECT OfferId FROM JobOffers WHERE StatusId = 1'
)
// Resultado: [316256, 316257, ..., 318000] (1000 ofertas)

// PASO 2: Obtener solo métricas actualizadas
const metricsResponse = await fetch(
  `/api/v1/job-offers/metrics?offerIds[]=${activeOfferIds.join('&offerIds[]=')}`
)
// Response: 400 KB (vs 800 KB si trajera datos de oferta también)

// PASO 3: Actualizar solo métricas en BD
metricsResponse.metrics.forEach(m => {
  updateMetrics(m.OfferId, m.lifetime, m.last30d, m.last7d, m.channelMetrics)
})
```

**Volumen estimado:** 1000-5000 ofertas por sync
**Frecuencia:** Cada 5 minutos
**Tráfico diario:** ~288 requests/día
**Beneficio:** 50% menos payload vs endpoint unificado

### 3.3 Dashboard On-Demand

**Objetivo:** Cargar dashboard con ofertas + métricas

**Opción A: Usar datos cacheados en BD Job Platform (recomendado)**

```javascript
// No requiere requests a Turijobs
const dashboard = await db.query(`
  SELECT o.*, m.lifetime, m.last30d, m.last7d
  FROM JobOffers o
  JOIN Metrics m ON o.OfferId = m.OfferId
  WHERE o.StatusId = 1
  LIMIT 100
`)
```

**Opción B: Requests paralelos a Turijobs (solo si datos no cacheados)**

```javascript
const [offers, metrics] = await Promise.all([
  fetch('/api/v1/job-offers/export?page=1&size=100'),
  fetch('/api/v1/job-offers/metrics?offerIds[]=' + ids.join('&offerIds[]='))
])
// Merge en frontend
```

---

## REQUISITO 4: CÓDIGOS DE ESTADO (statusId)

**Acción requerida:** Turijobs debe documentar qué valores utiliza para `statusId` y su significado.

**Ejemplo esperado:**

| statusId | Significado | ¿Job Platform debe distribuir? |
|----------|-------------|--------------------------------|
| 1 | Activa | Sí |
| 2 | Pausada | No |
| 3 | Expirada | No |
| 4 | Cerrada | No |

Job Platform necesita este mapeo para filtrar correctamente ofertas activas vs inactivas.

---

## REQUISITO 5: PERFORMANCE Y CACHING

### 5.1 Requisitos de Performance

| Métrica | Objetivo | Crítico |
|---------|----------|---------|
| **Response time** (ofertas) | <150ms para 100 ofertas | <400ms |
| **Response time** (métricas) | <100ms para 1000 ofertas | <300ms |
| **Throughput** | 100+ requests/minuto en picos | 50+ req/min |
| **Disponibilidad** | 99.5% uptime | 99% uptime |

### 5.2 Estrategia de Caching Recomendada (Turijobs)

**Para maximizar performance, sugerimos cache diferenciado:**

```javascript
// ENDPOINT /export (datos estructurales):
cache.set(`offer:${offerId}`, offerData, TTL_15min)
// Cambia poco (solo cuando se modifica oferta)

// ENDPOINT /metrics (datos dinámicos):
cache.set(`metrics:lifetime:${offerId}`, lifetimeData, TTL_15min)
cache.set(`metrics:last30d:${offerId}`, last30dData, TTL_5min)
cache.set(`metrics:last7d:${offerId}`, last7dData, TTL_2min)
// Cambia frecuentemente (cada aplicación nueva)
```

**Beneficio:** Reduce carga BD Turijobs en 80-90% durante horarios pico

### 5.3 Estrategia de Caching en Job Platform

```javascript
// Cache Redis con TTL optimizado
cache.set(`jp:offers:${offerId}`, offerData, TTL_15min)
cache.set(`jp:metrics:${offerId}`, metricsData, TTL_5min)
```

**Beneficio:** Reduce llamadas a Turijobs en 99% para requests repetitivos

---

## REQUISITO 6: AUTENTICACIÓN Y SEGURIDAD

### 6.1 Método de Autenticación

**Opción recomendada: API Key**

```http
GET /api/v1/job-offers/export?page=1&size=100
X-API-Key: jp_prod_a1b2c3d4e5f6g7h8i9j0
```

**Alternativas:**
- JWT Token: `Authorization: Bearer {token}`
- OAuth 2.0: `Authorization: Bearer {oauth_token}`

> **Decisión de Turijobs:** El equipo técnico decidirá el método más adecuado según su arquitectura de seguridad existente.

### 6.2 Rate Limiting

| Límite | Valor recomendado | Acción si se excede |
|--------|-------------------|---------------------|
| **Requests/hora** | 1000 por API key | HTTP 429 - Too Many Requests |
| **Burst requests** | 100 por minuto | HTTP 429 con header Retry-After |
| **Max offerIds** | 1000 IDs por request | HTTP 400 - Bad Request |

**Headers de rate limiting sugeridos:**

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1706284800
```

### 6.3 HTTPS Obligatorio

- ✅ Todas las llamadas deben ser por **HTTPS**
- ❌ HTTP plano NO permitido (datos sensibles)

---

## REQUISITO 7: CÓDIGOS DE RESPUESTA Y MANEJO DE ERRORES

### 7.1 Códigos HTTP Esperados

| Código | Significado | Cuándo usarlo |
|--------|-------------|---------------|
| **200 OK** | Éxito | Request procesado correctamente |
| **400 Bad Request** | Error validación | Parámetros inválidos (ej: size > 1000) |
| **401 Unauthorized** | Sin autenticación | API key faltante o inválida |
| **403 Forbidden** | Sin permisos | API key válida pero sin acceso a recurso |
| **404 Not Found** | Recurso no existe | Endpoint incorrecto |
| **422 Unprocessable Entity** | Error negocio | Filtros contradictorios |
| **429 Too Many Requests** | Rate limit excedido | Ver Requisito 6 |
| **500 Internal Server Error** | Error servidor | Error no controlado en Turijobs |
| **503 Service Unavailable** | Servicio caído | Mantenimiento o sobrecarga |

### 7.2 Formato de Errores

```json
{
  "error": {
    "code": "INVALID_PARAMETER",
    "message": "El parámetro 'size' no puede exceder 1000",
    "field": "size",
    "value": 5000,
    "timestamp": "2026-01-27T15:30:00Z",
    "requestId": "req_abc123xyz"
  }
}
```

**Códigos de error sugeridos:**

| Código | Descripción |
|--------|-------------|
| `INVALID_PARAMETER` | Parámetro con valor inválido |
| `MISSING_PARAMETER` | Parámetro requerido faltante |
| `INVALID_API_KEY` | API key no válida |
| `RATE_LIMIT_EXCEEDED` | Límite de requests excedido |
| `TOO_MANY_OFFER_IDS` | Más de 1000 offerIds en /metrics |
| `NO_DATA_FOUND` | Filtros no retornan resultados |
| `INTERNAL_ERROR` | Error interno del servidor |

---

## REQUISITO 8: TESTING Y VALIDACIÓN

### 8.1 Entorno de Testing

Antes del go-live, se requiere:

1. **Ambiente staging** con ambos endpoints de pruebas
2. **Dataset reducido** (~100-500 ofertas representativas)
3. **API key de testing** con rate limits más permisivos
4. **Documentación** de endpoints con ejemplos

### 8.2 Casos de Prueba Críticos

| Test | Criterio de éxito |
|------|-------------------|
| **Paginación** | Navegar 10 páginas sin errores |
| **Métricas calculadas** | Validar fórmulas (engagements = details + visits) |
| **Filtros dateFrom/dateTo** | Retornan rango correcto |
| **Performance /export** | 100 ofertas en <150ms |
| **Performance /metrics** | 1000 ofertas en <100ms |
| **Sync incremental** | Solo ofertas modificadas con dateFrom |
| **Ventanas temporales** | last7d < last30d < lifetime |
| **Rate limiting** | HTTP 429 al exceder límites |
| **Campos NULL** | Manejo correcto de valores opcionales |

### 8.3 Validación de Datos

Job Platform verificará:

- ✅ **IDs únicos** - No duplicados en `OfferId`
- ✅ **Fechas válidas** - ISO 8601 con timezone, no futuras ilógicas
- ✅ **Números positivos** - Métricas ≥0, salarios >0
- ✅ **Consistencia** - engagements ≤ touchpoints, applications ≤ engagements
- ✅ **Consistencia temporal** - last7d ≤ last30d ≤ lifetime
- ✅ **URLs válidas** - OfferUrl accesible y funcional

---

## REQUISITO 9: DOCUMENTACIÓN ESPERADA

### 9.1 Documentación Técnica

Turijobs debe proveer:

1. **Especificación OpenAPI/Swagger** de ambos endpoints
   - Esquema completo de request/response
   - Ejemplos de uso
   - Códigos de error

2. **Guía de integración** con:
   - Instrucciones de autenticación
   - Ejemplos de cURL/Postman
   - Rate limits y mejores prácticas
   - Flujos de sincronización recomendados

3. **Diccionario de datos** con:
   - Descripción de cada campo
   - Tipos de datos
   - Valores permitidos para IDs (statusId, areaId, etc.)

4. **Changelog** de versiones:
   - Cambios en schema
   - Campos deprecados
   - Breaking changes

### 9.2 Contacto Técnico

Turijobs debe designar:

- **Punto de contacto técnico** para coordinación
- **Canal de comunicación** (email, Slack, etc.)
- **SLA de respuesta** para incidencias críticas

---

## REQUISITO 10: CRONOGRAMA Y GO-LIVE

### 10.1 Fases de Implementación Sugeridas

| Fase | Duración | Entregables |
|------|----------|-------------|
| **1. Diseño técnico** | 1-2 semanas | Arquitectura de Turijobs, schema definitivo |
| **2. Desarrollo** | 3-4 semanas | Endpoints funcionales en staging |
| **3. Testing integrado** | 1-2 semanas | Validación conjunta Turijobs ↔ JP |
| **4. Go-live gradual** | 1 semana | 10% → 50% → 100% tráfico |
| **5. Monitoreo post-launch** | Continuo | Ajustes de performance |

### 10.2 Criterios de Go-Live

Para pasar a producción, se requiere:

- ✅ **100% tests pasando** en ambiente staging
- ✅ **Performance validado** (<150ms /export, <100ms /metrics)
- ✅ **Documentación completa** disponible
- ✅ **Monitoreo configurado** (Turijobs + Job Platform)
- ✅ **Plan de rollback** en caso de problemas

### 10.3 Estrategia de Despliegue

**Recomendación:** Go-live incremental

```
Semana 1: 10% tráfico (100 ofertas piloto)
→ Monitoreo intensivo
→ Validación de métricas
→ Ajustes de performance

Semana 2: 50% tráfico (15K ofertas)
→ Validación de carga
→ Optimización de queries

Semana 3: 100% tráfico (31K ofertas)
→ Monitoring continuo
→ Alertas automáticas
```

---

## RESUMEN DE RESPONSABILIDADES

### **Turijobs debe proveer:**

1. ✅ **Endpoint REST** `/api/v1/job-offers/export` (datos estructurales)
2. ✅ **Endpoint REST** `/api/v1/job-offers/metrics` (métricas de rendimiento)
3. ✅ **Métricas pre-calculadas** (lifetime + last30d + last7d) por oferta y canal
4. ✅ **Autenticación** vía API key, JWT u OAuth
5. ✅ **Documentación técnica** (OpenAPI, guías, diccionario de datos)
6. ✅ **Ambiente staging** para testing
7. ✅ **Soporte técnico** durante integración y go-live

### **Job Platform se encargará de:**

1. ✅ **Sincronización ofertas** cada 15 minutos (nuevas/modificadas)
2. ✅ **Sincronización métricas** cada 5 minutos (ofertas activas)
3. ✅ **Cache local Redis** (TTL 15min ofertas, 5min métricas)
4. ✅ **Merge de datos** (ofertas + métricas en BD local)
5. ✅ **Segmentación automática** de ofertas
6. ✅ **Distribución a canales externos** (Jooble, Talent, etc.)
7. ✅ **Dashboard analytics** para usuarios finales

---

## COORDINACIÓN TÉCNICA

### **Próximos pasos**

1. **Turijobs revisa** este documento funcional
2. **Turijobs confirma viabilidad** y propone cronograma
3. **Ambos equipos alinean** formato exacto de JSON
4. **Turijobs documenta statusId** y otros códigos de estado
5. **Turijobs desarrolla** endpoints en ambiente staging
6. **Testing conjunto** con dataset reducido
7. **Go-live incremental** según estrategia definida

### **Contacto Job Platform**

- **Empresa:** Job Platform SL
- **Punto de contacto:** [Nombre y email de contacto técnico]
- **Disponibilidad:** [Horarios de coordinación]
- **Canal preferido:** [Email, Slack, Teams, etc.]

---

## VERSIONADO DEL DOCUMENTO

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 1.0 | 26/01/2026 | Versión inicial - Endpoint unificado |
| 2.0 | 27/01/2026 | **Cambio arquitectónico:** Separación en 2 endpoints (/export + /metrics)<br>- Añadidos campos faltantes (area, language, brandName, etc.)<br>- Estructura métricas: lifetime + last30d + last7d<br>- Campos obligatorios expandidos<br>- Flujos de sincronización detallados |

---

**FIN DEL DOCUMENTO**

---

**Notas finales:**

- Este documento define **requisitos funcionales**, no especificaciones técnicas de implementación
- Turijobs tiene **libertad técnica** para implementar como considere óptimo
- La separación en 2 endpoints optimiza performance en 99% de los casos de uso
- Lo importante es cumplir con los **datos esperados** y **performance requerido**
- Se espera **colaboración activa** durante diseño, desarrollo y testing
- Ambos equipos se comprometen a **comunicación fluida** y **soporte mutuo**
