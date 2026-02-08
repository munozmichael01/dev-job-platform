# PLAN DE IMPLEMENTACIÓN - INTEGRACIÓN TURIJOBS
## Cambios de Base de Datos y Cálculos de Métricas

**Versión:** 1.0
**Fecha:** 2025-01-28
**Estado:** Pendiente de inicio (esperando entrega de endpoints Turijobs)

---

## 📋 TABLA DE CONTENIDOS

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [Cambios en Base de Datos](#cambios-en-base-de-datos)
3. [Algoritmos de Cálculo de Métricas](#algoritmos-de-cálculo-de-métricas)
4. [Lógica de Sincronización](#lógica-de-sincronización)
5. [Algoritmos de Detección (Fatiga/Momentum)](#algoritmos-de-detección)
6. [Cálculos de ROI por Canal](#cálculos-de-roi-por-canal)
7. [Plan de Migración](#plan-de-migración)
8. [Testing y Validación](#testing-y-validación)

---

## 📊 RESUMEN EJECUTIVO

### Objetivo
Implementar un sistema completo de tracking de métricas basado en el modelo de funnel de 4 niveles propuesto por Turijobs, con ventanas temporales y análisis por canal.

### Mejora Principal
**ANTES (CSV actual):**
- Solo campo `Source` disponible
- 65.7% de tráfico marcado como "other"
- Imposible calcular ROI por canal
- Sin visibilidad del funnel de conversión

**DESPUÉS (Turijobs integration):**
- Funnel completo: listImpressions → detailViews → pageVisits → applications
- 3 ventanas temporales: lifetime, last30d, last7d
- Métricas por canal (source/medium/campaign)
- Detección automática de fatiga y momentum
- ROI calculable por canal para optimización

### Componentes Principales
1. **Nuevas tablas BD**: `OfferMetrics`, `OfferMetricsByChannel`, `OfferMetricsHistory`
2. **2 servicios de sync**: OffersSync (15min) + MetricsSync (5min)
3. **4 algoritmos de cálculo**: Engagements, Touchpoints, ConversionRate, EngagementRate
4. **2 detectores**: Fatigue Detection + Momentum Detection
5. **Sistema de ROI**: CPA por canal + comparativa + auto-optimización

---

## 🗄️ CAMBIOS EN BASE DE DATOS

### Tabla 1: `OfferMetrics` (Métricas globales por oferta)

**Propósito:** Almacenar métricas agregadas por ventana temporal para cada oferta.

```sql
CREATE TABLE OfferMetrics (
  -- Primary Key
  OfferMetricId INT PRIMARY KEY IDENTITY(1,1),

  -- Foreign Keys
  OfferId INT NOT NULL,
  ExternalOfferId VARCHAR(50) NOT NULL, -- ID de Turijobs

  -- Temporal Window
  WindowType VARCHAR(20) NOT NULL, -- 'lifetime', 'last30d', 'last7d'

  -- Funnel Metrics (Nivel 1-4)
  TotalListImpressions INT DEFAULT 0,
  TotalDetailViews INT DEFAULT 0,
  TotalPageVisits INT DEFAULT 0,
  TotalApplications INT DEFAULT 0,

  -- Pre-calculated Metrics
  TotalEngagements INT DEFAULT 0, -- detailViews + pageVisits
  TotalTouchpoints INT DEFAULT 0, -- listImpressions + detailViews + pageVisits
  OverallConversionRate DECIMAL(10,4) DEFAULT 0.00, -- applications / touchpoints * 100
  EngagementApplicationRate DECIMAL(10,4) DEFAULT 0.00, -- applications / engagements * 100

  -- Metadata
  LastSyncAt DATETIME2 NOT NULL DEFAULT GETDATE(),
  CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
  UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),

  -- Constraints
  CONSTRAINT FK_OfferMetrics_OfferId FOREIGN KEY (OfferId)
    REFERENCES JobOffers(OfferId) ON DELETE CASCADE,

  CONSTRAINT UQ_OfferMetrics_OfferWindow
    UNIQUE (OfferId, WindowType),

  CONSTRAINT CHK_OfferMetrics_WindowType
    CHECK (WindowType IN ('lifetime', 'last30d', 'last7d'))
);

-- Índices para performance
CREATE INDEX IX_OfferMetrics_OfferId ON OfferMetrics(OfferId);
CREATE INDEX IX_OfferMetrics_ExternalOfferId ON OfferMetrics(ExternalOfferId);
CREATE INDEX IX_OfferMetrics_LastSyncAt ON OfferMetrics(LastSyncAt);
CREATE INDEX IX_OfferMetrics_WindowType ON OfferMetrics(WindowType);
```

**Ejemplo de datos:**

| OfferMetricId | OfferId | ExternalOfferId | WindowType | TotalListImpressions | TotalDetailViews | TotalPageVisits | TotalApplications | TotalEngagements | TotalTouchpoints | OverallConversionRate | EngagementApplicationRate |
|---------------|---------|-----------------|------------|---------------------|------------------|-----------------|-------------------|------------------|------------------|-----------------------|---------------------------|
| 1 | 1001 | 316256 | lifetime | 5000 | 500 | 250 | 30 | 750 | 5750 | 0.52 | 4.00 |
| 2 | 1001 | 316256 | last30d | 3000 | 300 | 150 | 18 | 450 | 3450 | 0.52 | 4.00 |
| 3 | 1001 | 316256 | last7d | 500 | 50 | 25 | 3 | 75 | 575 | 0.52 | 4.00 |

---

### Tabla 2: `OfferMetricsByChannel` (Métricas por canal)

**Propósito:** Desglosar métricas por source/medium/campaign para análisis de ROI.

```sql
CREATE TABLE OfferMetricsByChannel (
  -- Primary Key
  ChannelMetricId INT PRIMARY KEY IDENTITY(1,1),

  -- Foreign Keys
  OfferId INT NOT NULL,
  ExternalOfferId VARCHAR(50) NOT NULL,

  -- Channel Identification (UTM tracking)
  Source VARCHAR(100) NOT NULL, -- 'jooble', 'organic', 'talent', etc.
  Medium VARCHAR(100) NOT NULL, -- 'cpc', 'organic', 'cpa', etc.
  Campaign VARCHAR(200), -- 'campaign_2031', NULL for organic

  -- Temporal Window
  WindowType VARCHAR(20) NOT NULL, -- 'lifetime', 'last30d', 'last7d'

  -- Funnel Metrics (same structure as OfferMetrics)
  TotalListImpressions INT DEFAULT 0,
  TotalDetailViews INT DEFAULT 0,
  TotalPageVisits INT DEFAULT 0,
  TotalApplications INT DEFAULT 0,

  -- Pre-calculated Metrics
  TotalEngagements INT DEFAULT 0,
  TotalTouchpoints INT DEFAULT 0,
  OverallConversionRate DECIMAL(10,4) DEFAULT 0.00,
  EngagementApplicationRate DECIMAL(10,4) DEFAULT 0.00,

  -- Cost Tracking (for ROI calculation)
  ChannelSpend DECIMAL(10,2) DEFAULT 0.00, -- Linked to CampaignChannels.ActualSpend

  -- Metadata
  LastSyncAt DATETIME2 NOT NULL DEFAULT GETDATE(),
  CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),
  UpdatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),

  -- Constraints
  CONSTRAINT FK_ChannelMetrics_OfferId FOREIGN KEY (OfferId)
    REFERENCES JobOffers(OfferId) ON DELETE CASCADE,

  CONSTRAINT UQ_ChannelMetrics_OfferChannelWindow
    UNIQUE (OfferId, Source, Medium, Campaign, WindowType),

  CONSTRAINT CHK_ChannelMetrics_WindowType
    CHECK (WindowType IN ('lifetime', 'last30d', 'last7d'))
);

-- Índices para performance
CREATE INDEX IX_ChannelMetrics_OfferId ON OfferMetricsByChannel(OfferId);
CREATE INDEX IX_ChannelMetrics_Source ON OfferMetricsByChannel(Source);
CREATE INDEX IX_ChannelMetrics_WindowType ON OfferMetricsByChannel(WindowType);
CREATE INDEX IX_ChannelMetrics_LastSyncAt ON OfferMetricsByChannel(LastSyncAt);
```

**Ejemplo de datos:**

| ChannelMetricId | OfferId | Source | Medium | Campaign | WindowType | TotalApplications | ChannelSpend | CPA |
|-----------------|---------|--------|--------|----------|------------|-------------------|--------------|-----|
| 1 | 1001 | jooble | cpc | campaign_2031 | lifetime | 8 | 200.00 | 25.00 |
| 2 | 1001 | organic | organic | NULL | lifetime | 15 | 0.00 | 0.00 |
| 3 | 1001 | talent | cpa | campaign_2031 | lifetime | 7 | 126.00 | 18.00 |

---

### Tabla 3: `OfferMetricsHistory` (Histórico para trending)

**Propósito:** Mantener snapshots diarios para análisis de tendencias y detección de patrones.

```sql
CREATE TABLE OfferMetricsHistory (
  -- Primary Key
  HistoryId INT PRIMARY KEY IDENTITY(1,1),

  -- Foreign Keys
  OfferId INT NOT NULL,
  ExternalOfferId VARCHAR(50) NOT NULL,

  -- Snapshot Date
  SnapshotDate DATE NOT NULL, -- Fecha del snapshot (diario)

  -- Metrics Snapshot (lifetime window only)
  TotalListImpressions INT DEFAULT 0,
  TotalDetailViews INT DEFAULT 0,
  TotalPageVisits INT DEFAULT 0,
  TotalApplications INT DEFAULT 0,
  TotalEngagements INT DEFAULT 0,
  TotalTouchpoints INT DEFAULT 0,
  OverallConversionRate DECIMAL(10,4) DEFAULT 0.00,
  EngagementApplicationRate DECIMAL(10,4) DEFAULT 0.00,

  -- Metadata
  CreatedAt DATETIME2 NOT NULL DEFAULT GETDATE(),

  -- Constraints
  CONSTRAINT FK_MetricsHistory_OfferId FOREIGN KEY (OfferId)
    REFERENCES JobOffers(OfferId) ON DELETE CASCADE,

  CONSTRAINT UQ_MetricsHistory_OfferDate
    UNIQUE (OfferId, SnapshotDate)
);

-- Índices para performance
CREATE INDEX IX_MetricsHistory_OfferId ON OfferMetricsHistory(OfferId);
CREATE INDEX IX_MetricsHistory_SnapshotDate ON OfferMetricsHistory(SnapshotDate);
```

**Uso:** Permite queries como "mostrar trend de aplicaciones últimos 30 días" para gráficos.

---

### Tabla 4: Modificaciones a `JobOffers`

**Agregar columnas para datos estructurales de Turijobs:**

```sql
ALTER TABLE JobOffers ADD TitleId INT NULL;
ALTER TABLE JobOffers ADD TitleDenominationId INT NULL;
ALTER TABLE JobOffers ADD AreaId INT NULL;
ALTER TABLE JobOffers ADD SectorId INT NULL;
ALTER TABLE JobOffers ADD DegreeId INT NULL;
ALTER TABLE JobOffers ADD ExperienceId INT NULL;
ALTER TABLE JobOffers ADD ContractTypeId INT NULL;
ALTER TABLE JobOffers ADD WorkdayTypeId INT NULL;
ALTER TABLE JobOffers ADD SalaryTypeId INT NULL;
ALTER TABLE JobOffers ADD StatusId INT NULL; -- Ya existe, pero verificar
ALTER TABLE JobOffers ADD CompanyId INT NULL;
ALTER TABLE JobOffers ADD BrandId INT NULL;
ALTER TABLE JobOffers ADD CityId INT NULL;
ALTER TABLE JobOffers ADD RegionId INT NULL;
ALTER TABLE JobOffers ADD CountryId INT NULL;
ALTER TABLE JobOffers ADD LanguageId INT NULL;

-- Nuevos campos descriptivos (display names)
ALTER TABLE JobOffers ADD JobTitle NVARCHAR(255) NULL;
ALTER TABLE JobOffers ADD Area NVARCHAR(100) NULL;
ALTER TABLE JobOffers ADD BrandName NVARCHAR(255) NULL;
ALTER TABLE JobOffers ADD DegreeName NVARCHAR(100) NULL;
ALTER TABLE JobOffers ADD ExperienceName NVARCHAR(100) NULL;
ALTER TABLE JobOffers ADD ContractTypeName NVARCHAR(100) NULL;
ALTER TABLE JobOffers ADD WorkdayTypeName NVARCHAR(100) NULL;
ALTER TABLE JobOffers ADD Language NVARCHAR(100) NULL;
ALTER TABLE JobOffers ADD SalaryTypeName NVARCHAR(50) NULL;
ALTER TABLE JobOffers ADD SalaryCurrency NVARCHAR(10) NULL;
ALTER TABLE JobOffers ADD SalaryVisible BIT DEFAULT 0;
ALTER TABLE JobOffers ADD Requirements NVARCHAR(MAX) NULL;
ALTER TABLE JobOffers ADD ScheduleTime NVARCHAR(255) NULL;
ALTER TABLE JobOffers ADD StatusName NVARCHAR(50) NULL;
ALTER TABLE JobOffers ADD FinishDate DATETIME2 NULL;
ALTER TABLE JobOffers ADD LastModified DATETIME2 NULL;
ALTER TABLE JobOffers ADD OfferUrl NVARCHAR(500) NULL;
ALTER TABLE JobOffers ADD RedirectUrl NVARCHAR(500) NULL;
ALTER TABLE JobOffers ADD HasRedirect BIT DEFAULT 0;
ALTER TABLE JobOffers ADD IsBlind BIT DEFAULT 0;
ALTER TABLE JobOffers ADD IsFilled BIT DEFAULT 0;
ALTER TABLE JobOffers ADD IsFeatured BIT DEFAULT 0;
```

---

## 🧮 ALGORITMOS DE CÁLCULO DE MÉTRICAS

### Algoritmo 1: Total Engagements

**Definición:** Suma de interacciones significativas (detail views + page visits).

**Fórmula:**
```javascript
totalEngagements = totalDetailViews + totalPageVisits
```

**Implementación JavaScript:**
```javascript
function calculateTotalEngagements(metrics) {
  return (metrics.totalDetailViews || 0) + (metrics.totalPageVisits || 0);
}
```

**Implementación SQL:**
```sql
UPDATE OfferMetrics
SET TotalEngagements = TotalDetailViews + TotalPageVisits
WHERE OfferMetricId = @metricId;
```

**Ejemplo:**
- DetailViews: 500
- PageVisits: 250
- **TotalEngagements: 750**

---

### Algoritmo 2: Total Touchpoints

**Definición:** Suma de TODAS las interacciones del funnel (visibilidad + engagements).

**Fórmula:**
```javascript
totalTouchpoints = totalListImpressions + totalDetailViews + totalPageVisits
```

**Implementación JavaScript:**
```javascript
function calculateTotalTouchpoints(metrics) {
  return (metrics.totalListImpressions || 0)
       + (metrics.totalDetailViews || 0)
       + (metrics.totalPageVisits || 0);
}
```

**Implementación SQL:**
```sql
UPDATE OfferMetrics
SET TotalTouchpoints = TotalListImpressions + TotalDetailViews + TotalPageVisits
WHERE OfferMetricId = @metricId;
```

**Ejemplo:**
- ListImpressions: 5000
- DetailViews: 500
- PageVisits: 250
- **TotalTouchpoints: 5750**

---

### Algoritmo 3: Overall Conversion Rate

**Definición:** Porcentaje de aplicaciones sobre total de touchpoints.

**Fórmula:**
```javascript
overallConversionRate = (totalApplications / totalTouchpoints) * 100
```

**Implementación JavaScript:**
```javascript
function calculateOverallConversionRate(metrics) {
  const touchpoints = calculateTotalTouchpoints(metrics);
  if (touchpoints === 0) return 0;

  const applications = metrics.totalApplications || 0;
  return parseFloat(((applications / touchpoints) * 100).toFixed(4));
}
```

**Implementación SQL:**
```sql
UPDATE OfferMetrics
SET OverallConversionRate =
  CASE
    WHEN TotalTouchpoints = 0 THEN 0
    ELSE CAST((TotalApplications * 100.0 / TotalTouchpoints) AS DECIMAL(10,4))
  END
WHERE OfferMetricId = @metricId;
```

**Ejemplo:**
- Applications: 30
- Touchpoints: 5750
- **OverallConversionRate: 0.52%**

---

### Algoritmo 4: Engagement Application Rate

**Definición:** Porcentaje de aplicaciones sobre usuarios comprometidos (engagements).

**Fórmula:**
```javascript
engagementApplicationRate = (totalApplications / totalEngagements) * 100
```

**Implementación JavaScript:**
```javascript
function calculateEngagementApplicationRate(metrics) {
  const engagements = calculateTotalEngagements(metrics);
  if (engagements === 0) return 0;

  const applications = metrics.totalApplications || 0;
  return parseFloat(((applications / engagements) * 100).toFixed(4));
}
```

**Implementación SQL:**
```sql
UPDATE OfferMetrics
SET EngagementApplicationRate =
  CASE
    WHEN TotalEngagements = 0 THEN 0
    ELSE CAST((TotalApplications * 100.0 / TotalEngagements) AS DECIMAL(10,4))
  END
WHERE OfferMetricId = @metricId;
```

**Ejemplo:**
- Applications: 30
- Engagements: 750
- **EngagementApplicationRate: 4.00%**

---

## 🔄 LÓGICA DE SINCRONIZACIÓN

### Servicio 1: OffersSync (cada 15 minutos)

**Propósito:** Sincronizar datos estructurales de ofertas desde Turijobs `/export` endpoint.

**Pseudocódigo:**
```javascript
class TurijobsOffersSync {
  constructor() {
    this.syncInterval = 15 * 60 * 1000; // 15 minutos
    this.endpoint = 'https://api.turijobs.com/api/v1/job-offers/export';
  }

  async syncOffers() {
    try {
      console.log('🔄 Iniciando sync de ofertas Turijobs...');

      // 1. Fetch desde Turijobs
      const response = await fetch(this.endpoint, {
        headers: {
          'Authorization': `Bearer ${process.env.TURIJOBS_API_KEY}`,
          'X-Client-ID': process.env.TURIJOBS_CLIENT_ID
        }
      });

      const data = await response.json();
      const offers = data.offers || [];

      console.log(`✅ Obtenidas ${offers.length} ofertas de Turijobs`);

      // 2. Procesar cada oferta
      let updated = 0, inserted = 0, errors = 0;

      for (const offer of offers) {
        try {
          await this.upsertOffer(offer);

          // Verificar si existe en BD
          const exists = await this.offerExists(offer.OfferId);
          if (exists) {
            updated++;
          } else {
            inserted++;
          }
        } catch (error) {
          console.error(`❌ Error procesando oferta ${offer.OfferId}:`, error.message);
          errors++;
        }
      }

      console.log(`✅ Sync completado: ${updated} actualizadas, ${inserted} insertadas, ${errors} errores`);

      // 3. Archivar ofertas que ya no están en Turijobs
      await this.archiveRemovedOffers(offers.map(o => o.OfferId));

    } catch (error) {
      console.error('❌ Error en sync de ofertas:', error);
    }
  }

  async upsertOffer(offer) {
    // MERGE operation en SQL Server
    const query = `
      MERGE JobOffers AS target
      USING (SELECT @ExternalId AS ExternalId) AS source
      ON target.ExternalId = source.ExternalId
      WHEN MATCHED THEN
        UPDATE SET
          Title = @Title,
          JobTitle = @JobTitle,
          CompanyName = @CompanyName,
          City = @City,
          Region = @Region,
          Country = @Country,
          -- ... todos los campos actualizados
          LastModified = @LastModified,
          UpdatedAt = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (
          ExternalId, Title, JobTitle, CompanyName, City, Region, Country,
          TitleId, CompanyId, CityId, RegionId, CountryId,
          -- ... todos los campos
          CreatedAt, UpdatedAt
        )
        VALUES (
          @ExternalId, @Title, @JobTitle, @CompanyName, @City, @Region, @Country,
          @TitleId, @CompanyId, @CityId, @RegionId, @CountryId,
          -- ... todos los valores
          GETDATE(), GETDATE()
        );
    `;

    await db.query(query, {
      ExternalId: offer.OfferId,
      Title: offer.title,
      JobTitle: offer.jobTitle,
      CompanyName: offer.companyName,
      City: offer.city,
      Region: offer.region,
      Country: offer.country,
      TitleId: offer.titleId,
      CompanyId: offer.companyId,
      CityId: offer.cityId,
      RegionId: offer.regionId,
      CountryId: offer.countryId,
      // ... todos los parámetros mapeados
      LastModified: offer.lastModified
    });
  }

  async offerExists(externalId) {
    const result = await db.query(
      'SELECT COUNT(*) as count FROM JobOffers WHERE ExternalId = @ExternalId',
      { ExternalId: externalId }
    );
    return result[0].count > 0;
  }

  async archiveRemovedOffers(activeExternalIds) {
    // Marcar como archived (StatusId = 5) ofertas que ya no están en Turijobs
    const query = `
      UPDATE JobOffers
      SET StatusId = 5, -- Archived
          UpdatedAt = GETDATE()
      WHERE ExternalId NOT IN (${activeExternalIds.map(() => '?').join(',')})
        AND StatusId != 5
        AND UserId = @UserId -- Solo ofertas de Turijobs
    `;

    await db.query(query, [...activeExternalIds, process.env.TURIJOBS_USER_ID]);
  }

  start() {
    // Sync inicial
    this.syncOffers();

    // Programar sync cada 15 minutos
    setInterval(() => this.syncOffers(), this.syncInterval);

    console.log('✅ TurijobsOffersSync iniciado (cada 15 minutos)');
  }
}

module.exports = TurijobsOffersSync;
```

---

### Servicio 2: MetricsSync (cada 5 minutos)

**Propósito:** Sincronizar métricas de performance desde Turijobs `/metrics` endpoint.

**Pseudocódigo:**
```javascript
class TurijobsMetricsSync {
  constructor() {
    this.syncInterval = 5 * 60 * 1000; // 5 minutos
    this.endpoint = 'https://api.turijobs.com/api/v1/job-offers/metrics';
  }

  async syncMetrics() {
    try {
      console.log('📊 Iniciando sync de métricas Turijobs...');

      // 1. Fetch desde Turijobs
      const response = await fetch(this.endpoint, {
        headers: {
          'Authorization': `Bearer ${process.env.TURIJOBS_API_KEY}`,
          'X-Client-ID': process.env.TURIJOBS_CLIENT_ID
        }
      });

      const data = await response.json();
      const metricsArray = data.metrics || [];

      console.log(`✅ Obtenidas métricas de ${metricsArray.length} ofertas`);

      // 2. Procesar cada oferta
      let updated = 0, errors = 0;

      for (const offerMetrics of metricsArray) {
        try {
          // Obtener OfferId interno desde ExternalId
          const offerId = await this.getInternalOfferId(offerMetrics.OfferId);

          if (!offerId) {
            console.warn(`⚠️ Oferta ${offerMetrics.OfferId} no encontrada en BD local`);
            continue;
          }

          // Sync métricas globales (3 ventanas)
          await this.syncGlobalMetrics(offerId, offerMetrics.OfferId, offerMetrics.lifetime, 'lifetime');
          await this.syncGlobalMetrics(offerId, offerMetrics.OfferId, offerMetrics.last30d, 'last30d');
          await this.syncGlobalMetrics(offerId, offerMetrics.OfferId, offerMetrics.last7d, 'last7d');

          // Sync métricas por canal
          for (const channelMetric of offerMetrics.channelMetrics) {
            await this.syncChannelMetrics(offerId, offerMetrics.OfferId, channelMetric);
          }

          // Guardar snapshot diario para histórico
          await this.saveHistorySnapshot(offerId, offerMetrics.OfferId, offerMetrics.lifetime);

          updated++;
        } catch (error) {
          console.error(`❌ Error procesando métricas oferta ${offerMetrics.OfferId}:`, error.message);
          errors++;
        }
      }

      console.log(`✅ Sync métricas completado: ${updated} ofertas actualizadas, ${errors} errores`);

    } catch (error) {
      console.error('❌ Error en sync de métricas:', error);
    }
  }

  async getInternalOfferId(externalId) {
    const result = await db.query(
      'SELECT OfferId FROM JobOffers WHERE ExternalId = @ExternalId',
      { ExternalId: externalId }
    );
    return result.length > 0 ? result[0].OfferId : null;
  }

  async syncGlobalMetrics(offerId, externalId, metrics, windowType) {
    // Calcular métricas derivadas
    const totalEngagements = this.calculateTotalEngagements(metrics);
    const totalTouchpoints = this.calculateTotalTouchpoints(metrics);
    const overallConversionRate = this.calculateOverallConversionRate(metrics, totalTouchpoints);
    const engagementApplicationRate = this.calculateEngagementApplicationRate(metrics, totalEngagements);

    // MERGE operation
    const query = `
      MERGE OfferMetrics AS target
      USING (SELECT @OfferId AS OfferId, @WindowType AS WindowType) AS source
      ON target.OfferId = source.OfferId AND target.WindowType = source.WindowType
      WHEN MATCHED THEN
        UPDATE SET
          TotalListImpressions = @TotalListImpressions,
          TotalDetailViews = @TotalDetailViews,
          TotalPageVisits = @TotalPageVisits,
          TotalApplications = @TotalApplications,
          TotalEngagements = @TotalEngagements,
          TotalTouchpoints = @TotalTouchpoints,
          OverallConversionRate = @OverallConversionRate,
          EngagementApplicationRate = @EngagementApplicationRate,
          LastSyncAt = GETDATE(),
          UpdatedAt = GETDATE()
      WHEN NOT MATCHED THEN
        INSERT (
          OfferId, ExternalOfferId, WindowType,
          TotalListImpressions, TotalDetailViews, TotalPageVisits, TotalApplications,
          TotalEngagements, TotalTouchpoints, OverallConversionRate, EngagementApplicationRate,
          LastSyncAt, CreatedAt, UpdatedAt
        )
        VALUES (
          @OfferId, @ExternalOfferId, @WindowType,
          @TotalListImpressions, @TotalDetailViews, @TotalPageVisits, @TotalApplications,
          @TotalEngagements, @TotalTouchpoints, @OverallConversionRate, @EngagementApplicationRate,
          GETDATE(), GETDATE(), GETDATE()
        );
    `;

    await db.query(query, {
      OfferId: offerId,
      ExternalOfferId: externalId,
      WindowType: windowType,
      TotalListImpressions: metrics.totalListImpressions || 0,
      TotalDetailViews: metrics.totalDetailViews || 0,
      TotalPageVisits: metrics.totalPageVisits || 0,
      TotalApplications: metrics.totalApplications || 0,
      TotalEngagements: totalEngagements,
      TotalTouchpoints: totalTouchpoints,
      OverallConversionRate: overallConversionRate,
      EngagementApplicationRate: engagementApplicationRate
    });
  }

  async syncChannelMetrics(offerId, externalId, channelMetric) {
    // Sincronizar 3 ventanas por canal
    const windows = ['lifetime', 'last30d', 'last7d'];

    for (const windowType of windows) {
      const metrics = channelMetric[windowType];

      // Calcular métricas derivadas
      const totalEngagements = this.calculateTotalEngagements(metrics);
      const totalTouchpoints = this.calculateTotalTouchpoints(metrics);
      const overallConversionRate = this.calculateOverallConversionRate(metrics, totalTouchpoints);
      const engagementApplicationRate = this.calculateEngagementApplicationRate(metrics, totalEngagements);

      // Obtener gasto del canal desde CampaignChannels
      const channelSpend = await this.getChannelSpend(offerId, channelMetric.source, channelMetric.campaign);

      const query = `
        MERGE OfferMetricsByChannel AS target
        USING (
          SELECT @OfferId AS OfferId,
                 @Source AS Source,
                 @Medium AS Medium,
                 @Campaign AS Campaign,
                 @WindowType AS WindowType
        ) AS source
        ON target.OfferId = source.OfferId
           AND target.Source = source.Source
           AND target.Medium = source.Medium
           AND ISNULL(target.Campaign, '') = ISNULL(source.Campaign, '')
           AND target.WindowType = source.WindowType
        WHEN MATCHED THEN
          UPDATE SET
            TotalListImpressions = @TotalListImpressions,
            TotalDetailViews = @TotalDetailViews,
            TotalPageVisits = @TotalPageVisits,
            TotalApplications = @TotalApplications,
            TotalEngagements = @TotalEngagements,
            TotalTouchpoints = @TotalTouchpoints,
            OverallConversionRate = @OverallConversionRate,
            EngagementApplicationRate = @EngagementApplicationRate,
            ChannelSpend = @ChannelSpend,
            LastSyncAt = GETDATE(),
            UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (
            OfferId, ExternalOfferId, Source, Medium, Campaign, WindowType,
            TotalListImpressions, TotalDetailViews, TotalPageVisits, TotalApplications,
            TotalEngagements, TotalTouchpoints, OverallConversionRate, EngagementApplicationRate,
            ChannelSpend, LastSyncAt, CreatedAt, UpdatedAt
          )
          VALUES (
            @OfferId, @ExternalOfferId, @Source, @Medium, @Campaign, @WindowType,
            @TotalListImpressions, @TotalDetailViews, @TotalPageVisits, @TotalApplications,
            @TotalEngagements, @TotalTouchpoints, @OverallConversionRate, @EngagementApplicationRate,
            @ChannelSpend, GETDATE(), GETDATE(), GETDATE()
          );
      `;

      await db.query(query, {
        OfferId: offerId,
        ExternalOfferId: externalId,
        Source: channelMetric.source,
        Medium: channelMetric.medium,
        Campaign: channelMetric.campaign || null,
        WindowType: windowType,
        TotalListImpressions: metrics.totalListImpressions || 0,
        TotalDetailViews: metrics.totalDetailViews || 0,
        TotalPageVisits: metrics.totalPageVisits || 0,
        TotalApplications: metrics.totalApplications || 0,
        TotalEngagements: totalEngagements,
        TotalTouchpoints: totalTouchpoints,
        OverallConversionRate: overallConversionRate,
        EngagementApplicationRate: engagementApplicationRate,
        ChannelSpend: channelSpend
      });
    }
  }

  async getChannelSpend(offerId, source, campaign) {
    // Obtener gasto del canal desde CampaignChannels
    const query = `
      SELECT SUM(cc.ActualSpend) as TotalSpend
      FROM CampaignChannels cc
      INNER JOIN CampaignOffers co ON cc.CampaignId = co.CampaignId
      WHERE co.OfferId = @OfferId
        AND cc.ChannelId = @Source
        AND (cc.ExternalCampaignId = @Campaign OR @Campaign IS NULL)
    `;

    const result = await db.query(query, {
      OfferId: offerId,
      Source: source,
      Campaign: campaign || null
    });

    return result.length > 0 ? (result[0].TotalSpend || 0) : 0;
  }

  async saveHistorySnapshot(offerId, externalId, lifetimeMetrics) {
    // Guardar snapshot diario (solo lifetime) para trending
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD

    const totalEngagements = this.calculateTotalEngagements(lifetimeMetrics);
    const totalTouchpoints = this.calculateTotalTouchpoints(lifetimeMetrics);
    const overallConversionRate = this.calculateOverallConversionRate(lifetimeMetrics, totalTouchpoints);
    const engagementApplicationRate = this.calculateEngagementApplicationRate(lifetimeMetrics, totalEngagements);

    const query = `
      MERGE OfferMetricsHistory AS target
      USING (SELECT @OfferId AS OfferId, @SnapshotDate AS SnapshotDate) AS source
      ON target.OfferId = source.OfferId AND target.SnapshotDate = source.SnapshotDate
      WHEN MATCHED THEN
        UPDATE SET
          TotalListImpressions = @TotalListImpressions,
          TotalDetailViews = @TotalDetailViews,
          TotalPageVisits = @TotalPageVisits,
          TotalApplications = @TotalApplications,
          TotalEngagements = @TotalEngagements,
          TotalTouchpoints = @TotalTouchpoints,
          OverallConversionRate = @OverallConversionRate,
          EngagementApplicationRate = @EngagementApplicationRate
      WHEN NOT MATCHED THEN
        INSERT (
          OfferId, ExternalOfferId, SnapshotDate,
          TotalListImpressions, TotalDetailViews, TotalPageVisits, TotalApplications,
          TotalEngagements, TotalTouchpoints, OverallConversionRate, EngagementApplicationRate,
          CreatedAt
        )
        VALUES (
          @OfferId, @ExternalOfferId, @SnapshotDate,
          @TotalListImpressions, @TotalDetailViews, @TotalPageVisits, @TotalApplications,
          @TotalEngagements, @TotalTouchpoints, @OverallConversionRate, @EngagementApplicationRate,
          GETDATE()
        );
    `;

    await db.query(query, {
      OfferId: offerId,
      ExternalOfferId: externalId,
      SnapshotDate: today,
      TotalListImpressions: lifetimeMetrics.totalListImpressions || 0,
      TotalDetailViews: lifetimeMetrics.totalDetailViews || 0,
      TotalPageVisits: lifetimeMetrics.totalPageVisits || 0,
      TotalApplications: lifetimeMetrics.totalApplications || 0,
      TotalEngagements: totalEngagements,
      TotalTouchpoints: totalTouchpoints,
      OverallConversionRate: overallConversionRate,
      EngagementApplicationRate: engagementApplicationRate
    });
  }

  // Métodos de cálculo (reutilizables)
  calculateTotalEngagements(metrics) {
    return (metrics.totalDetailViews || 0) + (metrics.totalPageVisits || 0);
  }

  calculateTotalTouchpoints(metrics) {
    return (metrics.totalListImpressions || 0)
         + (metrics.totalDetailViews || 0)
         + (metrics.totalPageVisits || 0);
  }

  calculateOverallConversionRate(metrics, touchpoints) {
    if (touchpoints === 0) return 0;
    const applications = metrics.totalApplications || 0;
    return parseFloat(((applications / touchpoints) * 100).toFixed(4));
  }

  calculateEngagementApplicationRate(metrics, engagements) {
    if (engagements === 0) return 0;
    const applications = metrics.totalApplications || 0;
    return parseFloat(((applications / engagements) * 100).toFixed(4));
  }

  start() {
    // Sync inicial
    this.syncMetrics();

    // Programar sync cada 5 minutos
    setInterval(() => this.syncMetrics(), this.syncInterval);

    console.log('✅ TurijobsMetricsSync iniciado (cada 5 minutos)');
  }
}

module.exports = TurijobsMetricsSync;
```

---

## 🔍 ALGORITMOS DE DETECCIÓN

### Detector 1: Fatigue Detection (Detección de Fatiga)

**Propósito:** Identificar ofertas cuyo performance está decayendo significativamente.

**Criterio:**
- Promedio last7d < 50% promedio lifetime
- Solo para ofertas con al menos 14 días activas

**Implementación:**
```javascript
class FatigueDetector {
  constructor() {
    this.fatigueThreshold = 0.5; // 50%
    this.minimumDaysActive = 14;
  }

  async detectFatigue() {
    const query = `
      SELECT
        jo.OfferId,
        jo.ExternalId,
        jo.Title,
        jo.CompanyName,
        lifetime.TotalApplications as LifetimeApplications,
        last7d.TotalApplications as Last7dApplications,
        lifetime.OverallConversionRate as LifetimeConversionRate,
        last7d.OverallConversionRate as Last7dConversionRate,
        DATEDIFF(day, jo.PublicationDate, GETDATE()) as DaysActive,

        -- Calcular ratio
        CASE
          WHEN lifetime.TotalApplications = 0 THEN 0
          ELSE CAST(last7d.TotalApplications AS FLOAT) / CAST(lifetime.TotalApplications AS FLOAT)
        END as ApplicationsRatio,

        CASE
          WHEN lifetime.OverallConversionRate = 0 THEN 0
          ELSE last7d.OverallConversionRate / lifetime.OverallConversionRate
        END as ConversionRateRatio

      FROM JobOffers jo
      INNER JOIN OfferMetrics lifetime ON jo.OfferId = lifetime.OfferId AND lifetime.WindowType = 'lifetime'
      INNER JOIN OfferMetrics last7d ON jo.OfferId = last7d.OfferId AND last7d.WindowType = 'last7d'

      WHERE jo.StatusId = 1 -- Solo activas
        AND DATEDIFF(day, jo.PublicationDate, GETDATE()) >= @MinimumDaysActive
        AND (
          -- Fatiga por aplicaciones
          (lifetime.TotalApplications > 0 AND
           CAST(last7d.TotalApplications AS FLOAT) / CAST(lifetime.TotalApplications AS FLOAT) < @FatigueThreshold)
          OR
          -- Fatiga por conversion rate
          (lifetime.OverallConversionRate > 0 AND
           last7d.OverallConversionRate / lifetime.OverallConversionRate < @FatigueThreshold)
        )

      ORDER BY ApplicationsRatio ASC, ConversionRateRatio ASC
    `;

    const fatigueOffers = await db.query(query, {
      MinimumDaysActive: this.minimumDaysActive,
      FatigueThreshold: this.fatigueThreshold
    });

    // Procesar cada oferta con fatiga
    for (const offer of fatigueOffers) {
      await this.handleFatigueOffer(offer);
    }

    return fatigueOffers;
  }

  async handleFatigueOffer(offer) {
    console.warn(`⚠️ FATIGA DETECTADA - Oferta ${offer.ExternalId} (${offer.Title})`);
    console.warn(`   Ratio aplicaciones: ${(offer.ApplicationsRatio * 100).toFixed(1)}%`);
    console.warn(`   Ratio conversion: ${(offer.ConversionRateRatio * 100).toFixed(1)}%`);

    // Opciones de acción:
    // 1. Pausar campañas asociadas
    await this.pauseOfferCampaigns(offer.OfferId);

    // 2. Crear notificación para usuario
    await this.createFatigueNotification(offer);

    // 3. Ajustar presupuesto automáticamente
    await this.reduceOfferBudget(offer.OfferId, 0.5); // Reducir 50%
  }

  async pauseOfferCampaigns(offerId) {
    // Pausar todas las campañas activas que incluyan esta oferta
    const query = `
      UPDATE CampaignChannels
      SET Status = 2 -- Paused
      WHERE CampaignId IN (
        SELECT CampaignId FROM CampaignOffers WHERE OfferId = @OfferId
      )
      AND Status = 1 -- Solo las activas
    `;

    await db.query(query, { OfferId: offerId });
  }

  async createFatigueNotification(offer) {
    // Crear notificación en sistema
    const notification = {
      type: 'FATIGUE_DETECTED',
      severity: 'warning',
      offerId: offer.OfferId,
      title: `Fatiga detectada: ${offer.Title}`,
      message: `La oferta "${offer.Title}" de ${offer.CompanyName} muestra señales de fatiga. Performance últimos 7 días: ${(offer.ApplicationsRatio * 100).toFixed(0)}% vs promedio.`,
      actionSuggested: 'PAUSE_OR_REFRESH',
      createdAt: new Date()
    };

    // TODO: Insertar en tabla Notifications
    console.log('📬 Notificación creada:', notification);
  }

  async reduceOfferBudget(offerId, reductionFactor) {
    // Reducir presupuesto proporcionalmente
    const query = `
      UPDATE CampaignChannels
      SET AllocatedBudget = AllocatedBudget * @ReductionFactor
      WHERE CampaignId IN (
        SELECT CampaignId FROM CampaignOffers WHERE OfferId = @OfferId
      )
    `;

    await db.query(query, {
      OfferId: offerId,
      ReductionFactor: reductionFactor
    });
  }
}
```

**Ejemplo de detección:**
```
⚠️ FATIGA DETECTADA - Oferta 316256 (Empregado/a de Mesa)
   Lifetime: 30 aplicaciones, 0.52% conversion
   Last 7d: 8 aplicaciones, 0.25% conversion
   Ratio aplicaciones: 35.0% (< 50% threshold)
   Ratio conversion: 48.1% (< 50% threshold)

   ACCIÓN: Pausar campañas + Reducir presupuesto 50%
```

---

### Detector 2: Momentum Detection (Detección de Momentum)

**Propósito:** Identificar ofertas con performance excepcional reciente para aumentar inversión.

**Criterio:**
- Promedio last7d > 150% promedio lifetime
- Mínimo 50 aplicaciones lifetime

**Implementación:**
```javascript
class MomentumDetector {
  constructor() {
    this.momentumThreshold = 1.5; // 150%
    this.minimumApplications = 50;
  }

  async detectMomentum() {
    const query = `
      SELECT
        jo.OfferId,
        jo.ExternalId,
        jo.Title,
        jo.CompanyName,
        lifetime.TotalApplications as LifetimeApplications,
        last7d.TotalApplications as Last7dApplications,
        lifetime.OverallConversionRate as LifetimeConversionRate,
        last7d.OverallConversionRate as Last7dConversionRate,

        -- Calcular ratio
        CASE
          WHEN lifetime.TotalApplications = 0 THEN 0
          ELSE CAST(last7d.TotalApplications AS FLOAT) / CAST(lifetime.TotalApplications AS FLOAT)
        END as ApplicationsRatio,

        CASE
          WHEN lifetime.OverallConversionRate = 0 THEN 0
          ELSE last7d.OverallConversionRate / lifetime.OverallConversionRate
        END as ConversionRateRatio

      FROM JobOffers jo
      INNER JOIN OfferMetrics lifetime ON jo.OfferId = lifetime.OfferId AND lifetime.WindowType = 'lifetime'
      INNER JOIN OfferMetrics last7d ON jo.OfferId = last7d.OfferId AND last7d.WindowType = 'last7d'

      WHERE jo.StatusId = 1 -- Solo activas
        AND lifetime.TotalApplications >= @MinimumApplications
        AND (
          -- Momentum por aplicaciones
          (lifetime.TotalApplications > 0 AND
           CAST(last7d.TotalApplications AS FLOAT) / CAST(lifetime.TotalApplications AS FLOAT) > @MomentumThreshold)
          OR
          -- Momentum por conversion rate
          (lifetime.OverallConversionRate > 0 AND
           last7d.OverallConversionRate / lifetime.OverallConversionRate > @MomentumThreshold)
        )

      ORDER BY ApplicationsRatio DESC, ConversionRateRatio DESC
    `;

    const momentumOffers = await db.query(query, {
      MinimumApplications: this.minimumApplications,
      MomentumThreshold: this.momentumThreshold
    });

    // Procesar cada oferta con momentum
    for (const offer of momentumOffers) {
      await this.handleMomentumOffer(offer);
    }

    return momentumOffers;
  }

  async handleMomentumOffer(offer) {
    console.log(`🚀 MOMENTUM DETECTADO - Oferta ${offer.ExternalId} (${offer.Title})`);
    console.log(`   Ratio aplicaciones: ${(offer.ApplicationsRatio * 100).toFixed(1)}%`);
    console.log(`   Ratio conversion: ${(offer.ConversionRateRatio * 100).toFixed(1)}%`);

    // Opciones de acción:
    // 1. Aumentar presupuesto automáticamente
    await this.increaseOfferBudget(offer.OfferId, 1.5); // Aumentar 50%

    // 2. Crear notificación para usuario
    await this.createMomentumNotification(offer);

    // 3. Priorizar en campañas
    await this.prioritizeOfferInCampaigns(offer.OfferId);
  }

  async increaseOfferBudget(offerId, increaseFactor) {
    const query = `
      UPDATE CampaignChannels
      SET AllocatedBudget = AllocatedBudget * @IncreaseFactor
      WHERE CampaignId IN (
        SELECT CampaignId FROM CampaignOffers WHERE OfferId = @OfferId
      )
    `;

    await db.query(query, {
      OfferId: offerId,
      IncreaseFactor: increaseFactor
    });
  }

  async createMomentumNotification(offer) {
    const notification = {
      type: 'MOMENTUM_DETECTED',
      severity: 'success',
      offerId: offer.OfferId,
      title: `Momentum detectado: ${offer.Title}`,
      message: `La oferta "${offer.Title}" de ${offer.CompanyName} muestra excelente performance reciente. Últimos 7 días: ${(offer.ApplicationsRatio * 100).toFixed(0)}% vs promedio.`,
      actionSuggested: 'INCREASE_BUDGET',
      createdAt: new Date()
    };

    console.log('📬 Notificación creada:', notification);
  }

  async prioritizeOfferInCampaigns(offerId) {
    // Aumentar CPC/CPA para esta oferta específica
    // TODO: Implementar según lógica de cada canal
    console.log(`✅ Oferta ${offerId} priorizada en campañas`);
  }
}
```

**Ejemplo de detección:**
```
🚀 MOMENTUM DETECTADO - Oferta 316256 (Empregado/a de Mesa)
   Lifetime: 30 aplicaciones, 0.52% conversion
   Last 7d: 15 aplicaciones, 0.85% conversion
   Ratio aplicaciones: 180.0% (> 150% threshold)
   Ratio conversion: 163.5% (> 150% threshold)

   ACCIÓN: Aumentar presupuesto 50% + Priorizar en campañas
```

---

## 💰 CÁLCULOS DE ROI POR CANAL

### Algoritmo: CPA (Cost Per Application) por Canal

**Propósito:** Calcular costo por aplicación para cada canal y comparar eficiencia.

**Implementación:**
```javascript
class ChannelROICalculator {
  async calculateChannelCPA(offerId) {
    const query = `
      SELECT
        c.Source,
        c.Medium,
        c.Campaign,
        c.WindowType,
        c.TotalApplications,
        c.ChannelSpend,

        -- Calcular CPA
        CASE
          WHEN c.TotalApplications = 0 THEN NULL
          ELSE c.ChannelSpend / c.TotalApplications
        END as CPA,

        -- Calcular conversion rate
        c.OverallConversionRate,
        c.EngagementApplicationRate

      FROM OfferMetricsByChannel c
      WHERE c.OfferId = @OfferId
        AND c.WindowType = 'lifetime' -- Solo lifetime para ROI total
      ORDER BY CPA ASC NULLS LAST
    `;

    const channels = await db.query(query, { OfferId: offerId });

    return channels.map(ch => ({
      source: ch.Source,
      medium: ch.Medium,
      campaign: ch.Campaign,
      applications: ch.TotalApplications,
      spend: ch.ChannelSpend,
      cpa: ch.CPA,
      conversionRate: ch.OverallConversionRate,
      engagementRate: ch.EngagementApplicationRate
    }));
  }

  async compareChannelEfficiency(offerId) {
    const channels = await this.calculateChannelCPA(offerId);

    // Ordenar por CPA (menor = mejor)
    const paidChannels = channels
      .filter(ch => ch.spend > 0)
      .sort((a, b) => a.cpa - b.cpa);

    const organicChannels = channels
      .filter(ch => ch.spend === 0);

    console.log(`\n📊 ROI COMPARATIVO - Oferta ${offerId}:`);
    console.log('='.repeat(80));

    console.log('\n💰 CANALES PAGADOS (ordenados por CPA):');
    paidChannels.forEach(ch => {
      console.log(`   ${ch.source.padEnd(12)} | CPA: €${ch.cpa.toFixed(2)} | Apps: ${ch.applications} | Spend: €${ch.spend.toFixed(2)} | Conv: ${ch.conversionRate.toFixed(2)}%`);
    });

    console.log('\n🌱 CANALES ORGÁNICOS:');
    organicChannels.forEach(ch => {
      console.log(`   ${ch.source.padEnd(12)} | CPA: €0.00 | Apps: ${ch.applications} | Conv: ${ch.conversionRate.toFixed(2)}%`);
    });

    // Recomendaciones automáticas
    const recommendations = this.generateRecommendations(paidChannels, organicChannels);

    console.log('\n💡 RECOMENDACIONES:');
    recommendations.forEach(rec => {
      console.log(`   ${rec.icon} ${rec.message}`);
    });

    return { paidChannels, organicChannels, recommendations };
  }

  generateRecommendations(paidChannels, organicChannels) {
    const recommendations = [];

    if (paidChannels.length === 0) {
      recommendations.push({
        icon: '⚠️',
        message: 'Sin canales pagados activos. Considera iniciar campañas CPC/CPA.'
      });
      return recommendations;
    }

    // Calcular CPA promedio
    const avgCPA = paidChannels.reduce((sum, ch) => sum + ch.cpa, 0) / paidChannels.length;

    // Canal más caro (último en lista ordenada)
    const mostExpensive = paidChannels[paidChannels.length - 1];

    // Canal más barato (primero en lista ordenada)
    const cheapest = paidChannels[0];

    // Recomendación 1: Reducir canal más caro si está 2x sobre promedio
    if (mostExpensive.cpa > avgCPA * 2) {
      recommendations.push({
        icon: '🔻',
        message: `Reducir inversión en ${mostExpensive.source} (CPA €${mostExpensive.cpa.toFixed(2)}, 2x sobre promedio €${avgCPA.toFixed(2)})`
      });
    }

    // Recomendación 2: Aumentar canal más barato si tiene buen volumen
    if (cheapest.applications >= 10) {
      recommendations.push({
        icon: '🔺',
        message: `Aumentar inversión en ${cheapest.source} (CPA €${cheapest.cpa.toFixed(2)}, mejor performance)`
      });
    }

    // Recomendación 3: Comparar con orgánico
    const totalOrganic = organicChannels.reduce((sum, ch) => sum + ch.applications, 0);
    const totalPaid = paidChannels.reduce((sum, ch) => sum + ch.applications, 0);

    if (totalOrganic > totalPaid * 2) {
      recommendations.push({
        icon: '💡',
        message: `Orgánico genera ${totalOrganic} apps vs ${totalPaid} pagadas. Considera reducir presupuesto pagado.`
      });
    }

    return recommendations;
  }

  async optimizeBudgetAllocation(campaignId) {
    // Obtener todas las ofertas de la campaña
    const offers = await db.query(`
      SELECT OfferId FROM CampaignOffers WHERE CampaignId = @CampaignId
    `, { CampaignId: campaignId });

    let totalRecommendations = [];

    for (const offer of offers) {
      const { recommendations } = await this.compareChannelEfficiency(offer.OfferId);
      totalRecommendations = totalRecommendations.concat(recommendations);
    }

    // Aplicar recomendaciones automáticamente (opcional)
    // await this.applyRecommendations(totalRecommendations);

    return totalRecommendations;
  }
}
```

**Ejemplo de output:**
```
📊 ROI COMPARATIVO - Oferta 316256:
================================================================================

💰 CANALES PAGADOS (ordenados por CPA):
   jooble       | CPA: €18.50 | Apps: 8  | Spend: €148.00 | Conv: 0.58%
   talent       | CPA: €20.00 | Apps: 7  | Spend: €140.00 | Conv: 0.55%
   whatjobs     | CPA: €28.00 | Apps: 5  | Spend: €140.00 | Conv: 0.45%

🌱 CANALES ORGÁNICOS:
   organic      | CPA: €0.00  | Apps: 15 | Conv: 0.52%

💡 RECOMENDACIONES:
   🔻 Reducir inversión en whatjobs (CPA €28.00, 2x sobre promedio €22.17)
   🔺 Aumentar inversión en jooble (CPA €18.50, mejor performance)
   💡 Orgánico genera 15 apps vs 20 pagadas. Performance comparable a coste cero.
```

---

## 🚀 PLAN DE MIGRACIÓN

### Fase 1: Preparación (Semana 1)

**Objetivo:** Crear infraestructura de BD y servicios base.

**Tareas:**
1. ✅ Ejecutar scripts de creación de tablas:
   - `OfferMetrics`
   - `OfferMetricsByChannel`
   - `OfferMetricsHistory`
   - Modificaciones a `JobOffers`

2. ✅ Crear servicios de sincronización:
   - `TurijobsOffersSync.js`
   - `TurijobsMetricsSync.js`

3. ✅ Implementar algoritmos de cálculo:
   - Módulo `metricsCalculator.js` con 4 funciones

4. ✅ Setup variables de entorno:
   ```env
   TURIJOBS_API_KEY=your_api_key_here
   TURIJOBS_CLIENT_ID=your_client_id_here
   TURIJOBS_OFFERS_ENDPOINT=https://api.turijobs.com/api/v1/job-offers/export
   TURIJOBS_METRICS_ENDPOINT=https://api.turijobs.com/api/v1/job-offers/metrics
   TURIJOBS_USER_ID=11
   ```

---

### Fase 2: Testing con Datos Mock (Semana 2)

**Objetivo:** Validar lógica sin depender de API Turijobs.

**Tareas:**
1. ✅ Crear mock responses JSON:
   - `mocks/turijobs-offers-response.json` (10 ofertas ejemplo)
   - `mocks/turijobs-metrics-response.json` (métricas ejemplo)

2. ✅ Testing unitario:
   - Algoritmos de cálculo (4 tests)
   - MERGE operations en BD (3 tests)
   - Detección de fatiga/momentum (2 tests)

3. ✅ Verificar integridad referencial:
   - Foreign keys funcionando
   - Unique constraints sin conflictos
   - Índices mejorando performance

---

### Fase 3: Integración Real API Turijobs (Semana 3)

**Objetivo:** Conectar con endpoints reales de Turijobs.

**Tareas:**
1. 🔄 Obtener credenciales de producción:
   - API key de Turijobs
   - Client ID asignado

2. 🔄 Primer sync de ofertas:
   - Ejecutar `TurijobsOffersSync` manualmente
   - Verificar MERGE de ofertas en `JobOffers`
   - Validar mapeo de campos

3. 🔄 Primer sync de métricas:
   - Ejecutar `TurijobsMetricsSync` manualmente
   - Verificar datos en `OfferMetrics` y `OfferMetricsByChannel`
   - Validar cálculos derivados

4. 🔄 Programar syncs automáticos:
   - Ofertas cada 15 minutos
   - Métricas cada 5 minutos

---

### Fase 4: Implementación Detectores (Semana 4)

**Objetivo:** Activar detección automática de fatiga y momentum.

**Tareas:**
1. 🔄 Deploy `FatigueDetector`:
   - Ejecución diaria (cada 24h)
   - Notificaciones automáticas
   - Pausar campañas con fatiga severa

2. 🔄 Deploy `MomentumDetector`:
   - Ejecución cada 6 horas
   - Aumentar presupuestos automáticamente
   - Notificaciones de oportunidades

3. 🔄 Dashboard de métricas:
   - Gráficos de funnel por oferta
   - Comparativa canales
   - Alertas de fatiga/momentum

---

### Fase 5: Optimización y ROI (Semana 5)

**Objetivo:** Implementar cálculos de ROI y auto-optimización.

**Tareas:**
1. 🔄 Deploy `ChannelROICalculator`:
   - CPA por canal
   - Recomendaciones automáticas
   - Redistribución de presupuesto

2. 🔄 Reports semanales:
   - Performance por canal
   - ROI comparativo
   - Recomendaciones accionables

3. 🔄 Auto-optimización (opcional):
   - Ajuste automático de presupuestos
   - Pausar canales ineficientes
   - Escalar canales exitosos

---

## ✅ TESTING Y VALIDACIÓN

### Test Suite 1: Algoritmos de Cálculo

```javascript
describe('MetricsCalculator', () => {
  test('calculateTotalEngagements - suma detailViews + pageVisits', () => {
    const metrics = {
      totalDetailViews: 500,
      totalPageVisits: 250
    };

    expect(calculateTotalEngagements(metrics)).toBe(750);
  });

  test('calculateTotalTouchpoints - suma listImpressions + detailViews + pageVisits', () => {
    const metrics = {
      totalListImpressions: 5000,
      totalDetailViews: 500,
      totalPageVisits: 250
    };

    expect(calculateTotalTouchpoints(metrics)).toBe(5750);
  });

  test('calculateOverallConversionRate - apps/touchpoints*100', () => {
    const metrics = {
      totalApplications: 30,
      totalListImpressions: 5000,
      totalDetailViews: 500,
      totalPageVisits: 250
    };
    const touchpoints = 5750;

    expect(calculateOverallConversionRate(metrics, touchpoints)).toBeCloseTo(0.52, 2);
  });

  test('calculateEngagementApplicationRate - apps/engagements*100', () => {
    const metrics = {
      totalApplications: 30,
      totalDetailViews: 500,
      totalPageVisits: 250
    };
    const engagements = 750;

    expect(calculateEngagementApplicationRate(metrics, engagements)).toBeCloseTo(4.00, 2);
  });

  test('handleZeroDivision - retorna 0 cuando denominador es 0', () => {
    const metrics = {
      totalApplications: 30,
      totalListImpressions: 0,
      totalDetailViews: 0,
      totalPageVisits: 0
    };

    expect(calculateOverallConversionRate(metrics, 0)).toBe(0);
  });
});
```

---

### Test Suite 2: MERGE Operations

```javascript
describe('Database MERGE Operations', () => {
  beforeEach(async () => {
    // Limpiar tablas de test
    await db.query('DELETE FROM OfferMetrics WHERE OfferId IN (9999, 10000)');
  });

  test('MERGE inserta nuevo registro cuando no existe', async () => {
    await syncGlobalMetrics(9999, '999999', {
      totalListImpressions: 1000,
      totalDetailViews: 100,
      totalPageVisits: 50,
      totalApplications: 5
    }, 'lifetime');

    const result = await db.query(
      'SELECT * FROM OfferMetrics WHERE OfferId = 9999 AND WindowType = \'lifetime\''
    );

    expect(result.length).toBe(1);
    expect(result[0].TotalListImpressions).toBe(1000);
    expect(result[0].TotalApplications).toBe(5);
  });

  test('MERGE actualiza registro existente', async () => {
    // Primera inserción
    await syncGlobalMetrics(10000, '1000000', {
      totalListImpressions: 1000,
      totalApplications: 5
    }, 'lifetime');

    // Actualización
    await syncGlobalMetrics(10000, '1000000', {
      totalListImpressions: 1500,
      totalApplications: 10
    }, 'lifetime');

    const result = await db.query(
      'SELECT * FROM OfferMetrics WHERE OfferId = 10000 AND WindowType = \'lifetime\''
    );

    expect(result.length).toBe(1); // Solo 1 registro, no duplicado
    expect(result[0].TotalListImpressions).toBe(1500); // Valor actualizado
    expect(result[0].TotalApplications).toBe(10); // Valor actualizado
  });

  test('UNIQUE constraint previene duplicados', async () => {
    await syncGlobalMetrics(10000, '1000000', {
      totalListImpressions: 1000,
      totalApplications: 5
    }, 'lifetime');

    // Intentar insertar duplicado directo (bypass MERGE)
    await expect(
      db.query(`
        INSERT INTO OfferMetrics (OfferId, ExternalOfferId, WindowType, TotalListImpressions)
        VALUES (10000, '1000000', 'lifetime', 2000)
      `)
    ).rejects.toThrow(/UNIQUE constraint/);
  });
});
```

---

### Test Suite 3: Detección de Fatiga/Momentum

```javascript
describe('FatigueDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new FatigueDetector();
  });

  test('detecta fatiga cuando last7d < 50% lifetime', async () => {
    // Setup: Crear oferta con métricas de fatiga
    await createTestOffer(11111, {
      lifetime: { totalApplications: 100 },
      last7d: { totalApplications: 30 } // 30% < 50%
    });

    const fatigueOffers = await detector.detectFatigue();

    expect(fatigueOffers.length).toBeGreaterThan(0);
    expect(fatigueOffers[0].OfferId).toBe(11111);
    expect(fatigueOffers[0].ApplicationsRatio).toBeLessThan(0.5);
  });

  test('NO detecta fatiga cuando last7d >= 50% lifetime', async () => {
    await createTestOffer(11112, {
      lifetime: { totalApplications: 100 },
      last7d: { totalApplications: 60 } // 60% >= 50%
    });

    const fatigueOffers = await detector.detectFatigue();

    expect(fatigueOffers.find(o => o.OfferId === 11112)).toBeUndefined();
  });
});

describe('MomentumDetector', () => {
  let detector;

  beforeEach(() => {
    detector = new MomentumDetector();
  });

  test('detecta momentum cuando last7d > 150% lifetime', async () => {
    await createTestOffer(11113, {
      lifetime: { totalApplications: 100 },
      last7d: { totalApplications: 180 } // 180% > 150%
    });

    const momentumOffers = await detector.detectMomentum();

    expect(momentumOffers.length).toBeGreaterThan(0);
    expect(momentumOffers[0].OfferId).toBe(11113);
    expect(momentumOffers[0].ApplicationsRatio).toBeGreaterThan(1.5);
  });
});
```

---

## 📊 CHECKLIST DE ENTREGA

### Pre-requisitos
- [ ] API Turijobs entregada y documentada
- [ ] Credenciales de producción obtenidas (API key + Client ID)
- [ ] Ambiente de staging configurado

### Base de Datos
- [ ] Tablas creadas: `OfferMetrics`, `OfferMetricsByChannel`, `OfferMetricsHistory`
- [ ] Columnas agregadas a `JobOffers`
- [ ] Índices creados y validados
- [ ] Foreign keys configuradas
- [ ] Unique constraints funcionando

### Servicios
- [ ] `TurijobsOffersSync` implementado y testeado
- [ ] `TurijobsMetricsSync` implementado y testeado
- [ ] `FatigueDetector` implementado
- [ ] `MomentumDetector` implementado
- [ ] `ChannelROICalculator` implementado

### Testing
- [ ] Tests unitarios algoritmos (4 tests pasando)
- [ ] Tests MERGE operations (3 tests pasando)
- [ ] Tests detectores (2 tests pasando)
- [ ] Tests integración con mocks
- [ ] Tests end-to-end con API real

### Deployment
- [ ] Variables de entorno configuradas
- [ ] Syncs programados (15min/5min)
- [ ] Detectores programados (diario/6h)
- [ ] Monitoring y alertas configuradas
- [ ] Dashboard actualizado con nuevas métricas

### Documentación
- [ ] README actualizado con nuevos endpoints
- [ ] Diagramas de flujo de datos
- [ ] Guía de troubleshooting
- [ ] Changelog con cambios de BD

---

## 🎯 MÉTRICAS DE ÉXITO

### Performance
- ✅ Sync ofertas: <5 segundos para 1000 ofertas
- ✅ Sync métricas: <10 segundos para 1000 ofertas
- ✅ Queries dashboard: <500ms con índices
- ✅ Detectores: <2 minutos para todo el catálogo

### Funcionalidad
- ✅ 0% errores en sync después de 48h
- ✅ 100% ofertas con métricas completas (3 ventanas)
- ✅ Fatiga detectada en <24h desde inicio
- ✅ ROI calculado correctamente para todos los canales

### Business Impact
- ✅ Reducción 30% en CPA promedio (optimización automática)
- ✅ Aumento 20% en aplicaciones (momentum detection)
- ✅ Pausa automática de campañas con fatiga severa
- ✅ Visibilidad completa del funnel de conversión

---

**FIN DEL DOCUMENTO**

*Para preguntas o aclaraciones sobre este plan de implementación, contactar al equipo de desarrollo.*
