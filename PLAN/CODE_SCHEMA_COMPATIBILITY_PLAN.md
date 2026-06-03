# Plan de Compatibilidad Código + Schema
## Qué se rompe con `proposed-clean-domain-schema.sql` y cómo arreglarlo

**Fecha:** 2026-06-03
**Autores:** Codex (criterio) + Claude Code (auditoría)
**Status:** ANÁLISIS — sin ejecutar nada aún

---

## Resumen ejecutivo

El nuevo schema rompe **4 rutas backend y 1 servicio** en puntos específicos y conocidos. Ninguno es un riesgo oculto: todos están aquí documentados con línea exacta. El código puede actualizarse en paralelo al schema — no necesita ejecutarse primero ni después.

**Orden recomendado:** Código primero, schema después.

---

## 1. Archivos afectados

| Archivo | Tipo de afectación | Gravedad |
|---|---|---|
| `backend/src/routes/jobOffers.js` | PK + Status type + columnas legacy | **Alta** — falla en producción hoy |
| `backend/src/routes/segments.js` | Filters→FilterDefinition, OfferCount, SQL Server syntax | **Alta** — todo depende de adapter |
| `backend/src/routes/campaigns.js` | Channels JSON, CampaignSegments, columnas removidas | **Alta** — múltiples contratos rotos |
| `backend/src/services/campaignDistributionService.js` | StatusId, OfferId, CampaignChannels schema, CampaignSegments | **Alta** — core del motor de distribución |
| `backend/src/routes/connections.js` | Solo lee JobOffers.ConnectionId y columnas de contenido | **Baja** — compatible con nuevo schema |

---

## 2. `backend/src/routes/jobOffers.js`

### Columnas que usa hoy vs nuevo schema

| Uso actual | Columna actual | Columna nueva | ¿Roto? |
|---|---|---|---|
| PK para eq/update | `OfferId` | `Id` | ✅ Ya corregido en refactor |
| Status filter | `StatusId` (INTEGER) | `Status` (VARCHAR) | ⚠️ Lógica de mapeo cambia |
| Status display | CASE WHEN StatusId=1→'active' | `Status` ya es string | ⚠️ CASE eliminar |
| Budget/performance | `BudgetSpent`, `ApplicationsReceived` | No existen en nuevo schema | ⚠️ Hardcoded a 0, ya documentado |
| Filtro promoción | CampaignChannels.OfferId | CampaignChannels sin OfferId | **✘ Roto** — schema nuevo no tiene OfferId en CampaignChannels |

### Cambios necesarios

```
jobOffers.js:
  L68 → StatusId filter: reemplazar STATUS_MAP numérico por string directo
        Hoy: .eq('StatusId', STATUS_MAP[cleanStatus])
        Nuevo: .eq('Status', cleanStatus)  // 'active', 'paused', etc.

  L75-L77 → mapOffer(): eliminar mapStatus() — Status ya es string
             Hoy: status: mapStatus(row.StatusId)
             Nuevo: status: row.Status

  L360-L381 → Filtro promoción via CampaignChannels.OfferId
              Hoy: .from('CampaignChannels').select('OfferId')
              Nuevo: CampaignChannels nuevo tiene JobOfferId (no OfferId)
              Cambio: .select('JobOfferId') → map r => r.JobOfferId
              Nota: JobOfferId es el nombre correcto en el nuevo schema

  L432 → statsBase y count queries ya usan OfferId/select('OfferId')
         Después del schema: cambiar a select('Id', ...) ya que PK es Id

  L505 → PUT status: .eq('OfferId', offerId) → .eq('Id', offerId)
         Ya corregido en refactor, pero recordar que PK cambia de OfferId a Id
```

**Impacto en el frontend:** El contrato de respuesta no cambia. `id` en el JSON sigue siendo el mismo entero. El frontend no ve la diferencia entre `OfferId` e `Id` porque `mapOffer()` siempre devuelve `id: row.OfferId` (o `row.Id`).

---

## 3. `backend/src/routes/segments.js`

### Columnas que usa hoy vs nuevo schema

| Uso actual | Columna/tabla actual | En nuevo schema | ¿Roto? |
|---|---|---|---|
| Leer filtros | `Segments.Filters` (TEXT) | `Segments.FilterDefinition` (JSONB) | **✘ Roto** — columna renombrada |
| Contar ofertas | `Segments.OfferCount` (INTEGER stored) | No existe — calculado | **✘ Roto** — columna eliminada |
| Leer/escribir segmentos | `pool.request()` + SQL Server adapter | Supabase nativo | **✘ Roto** — adapter en toda la ruta |
| Estimar ofertas | `JobOffers WITH (READPAST)` hint | `JobOffers` sin hints | **✘ Roto** — SQL Server syntax |
| Campañas del segmento | `CampaignSegments` JOIN | No existe — `Campaigns.SegmentId` FK directo | **✘ Roto** — tabla eliminada |
| Muestra de ofertas | `JobOffers.Id`, `.StatusId = 1` | `JobOffers.Id`, `.Status = 'active'` | ⚠️ StatusId → Status |

### Cambios necesarios

```
segments.js — REESCRITURA COMPLETA (toda la ruta usa pool.request())

  L3  → Eliminar: const { pool, poolConnect, sql } = require('../db/db')
        Añadir:   const { supabase } = require('../db/db')

  L6-21 → parseFilters(): CONSERVAR — lógica de parsing de Filters JSON
           Pero adaptar: ahora lee de FilterDefinition no Filters
           Y el JSON puede venir ya parseado (JSONB en Postgres)

  L24-70 → buildWhereFromFilters(): REESCRIBIR
            Hoy: construye WHERE clauses para pool.request()
            Nuevo: construye filtros para Supabase query builder
            Lógica de negocio (jobTitles→Title LIKE, etc.) se conserva
            Implementación cambia de SQL strings a .ilike()/.eq()/.or()

  L79 → SELECT s.Id, s.Name, s.Description, s.Filters, s.OfferCount...
         Nuevo: s.Id, s.Name, s.Description, s.FilterDefinition, s.Type, s.Status...
         OfferCount: calcular on-the-fly via COUNT de JobOffers
         CampaignCount: calcular via COUNT de Campaigns WHERE SegmentId=s.Id

  L149 → COUNT(*) AS total FROM JobOffers WITH (READPAST) → Supabase count
  L163 → INSERT INTO Segments (...Filters, ...OfferCount...) → insert con FilterDefinition sin OfferCount

  L222-226 → UPDATE con OfferCount → omitir OfferCount, UPDATE FilterDefinition

  L238 → DELETE check: FROM Campaigns WHERE SegmentId=@Id → .eq('SegmentId', id) en Supabase

  L407-412 → CampaignSegments JOIN → Campaigns WHERE SegmentId=id
             Tabla CampaignSegments no existe en nuevo schema
             Los segmentos van directamente por Campaigns.SegmentId

  L433-436 → JobOffers WITH (READPAST) → eliminar hint

  L494 → INSERT INTO Segments (...UserId omitido en duplicate...) → añadir UserId
```

**Nota crítica:** `CampaignSegments` es una tabla intermedia que **no existe en el nuevo schema**. El nuevo schema usa `Campaigns.SegmentId` (FK directa a un segmento). Si la lógica multi-segmento es necesaria, hay que decidir si `CampaignSegments` se añade al nuevo schema o si se limita a un segmento por campaña.

---

## 4. `backend/src/routes/campaigns.js`

### Columnas que usa hoy vs nuevo schema

| Uso actual | Columna/tabla actual | En nuevo schema | ¿Roto? |
|---|---|---|---|
| Canales de la campaña | `Campaigns.Channels` (JSON TEXT) | No existe — `CampaignChannels` tabla | **✘ Roto** — columna eliminada |
| Segmentos múltiples | `CampaignSegments` tabla | No existe en nuevo schema | **✘ Roto** — tabla eliminada |
| DistributionType | `Campaigns.DistributionType` | No está en nuevo schema | **✘ Roto** — columna no incluida |
| BidStrategy, ManualBid, Priority, AutoOptimization | En Campaigns hoy | No están en nuevo Campaigns | **✘ Roto** — movidos a CampaignChannels |
| MaxCPA, TargetApplications | En Campaigns | No están en nuevo Campaigns | **✘ Roto** — omitidos |
| SegmentOffers (JOIN) | `Segments.OfferCount` | No existe — calculado | **✘ Roto** |
| Credenciales al activar | `UserChannelCredentials.EncryptedCredentials` | `ChannelCredentials.CredentialsEncrypted` | **✘ Roto** — tabla y columna renombrada |
| pool.request() en toda la ruta | SQL Server adapter | Supabase nativo | **✘ Roto** |

### Cambios necesarios

```
campaigns.js — REESCRITURA PARCIAL (adaptar contratos y lógica de negocio)

  L3  → Migrar a Supabase nativo (eliminar pool, poolConnect, sql)

  L22-85 (GET /) →
    - Eliminar JOIN Segments s ON c.SegmentId = s.Id (Segments.OfferCount ya no existe)
    - Eliminar JOIN CampaignSegments (tabla eliminada)
    - Calcular SegmentOffers via COUNT de JobOffers con FilterDefinition del segmento
    - Channels: leer de CampaignChannels JOIN DistributionChannels en vez de JSON
    - Devolver Channels como array de objetos {id, code, name} no como strings

  L88-258 (POST /) →
    - Eliminar campos: Channels (JSON), DistributionType, BidStrategy, ManualBid,
                       Priority, AutoOptimization, MaxCPA, TargetApplications de Campaigns
    - Campaigns nuevo solo tiene: Name, Description, SegmentId, BudgetTotal, BudgetCurrency,
                                   StartDate, EndDate, Status, UserId, CreatedByUserId
    - Los campos de distribución van a CampaignChannels (Budget, BidStrategy, Config)
    - CampaignSegments → usar Campaigns.SegmentId (un segmento por campaña) o añadir tabla
    - Channels JSON → insertar rows en CampaignChannels con FK a DistributionChannels

  L261-320 (PUT /:id) →
    - Mismos campos removidos que en POST
    - Channels → actualizar CampaignChannels rows (upsert)

  L744-785 (DELETE /:id) →
    - 'DELETE FROM CampaignChannels' → Supabase .delete().eq('CampaignId', id)
      (con CASCADE en FK, puede ser automático)

  L974 (activate/:id → UserChannelCredentials) →
    - Tabla: UserChannelCredentials → ChannelCredentials
    - Columna: EncryptedCredentials → CredentialsEncrypted
    - Columna: ChannelId (string) → ChannelId (INT FK a DistributionChannels)
    - Query: SELECT EncryptedCredentials FROM UserChannelCredentials WHERE UserId=X AND ChannelId='jooble'
      → SELECT CredentialsEncrypted FROM ChannelCredentials WHERE UserId=X AND ChannelId=(SELECT Id FROM DistributionChannels WHERE Code='jooble')
```

**Decisión pendiente para Codex:** ¿Un segmento por campaña (Campaigns.SegmentId FK directa) o múltiples (necesitaría añadir CampaignSegments al nuevo schema)? `campaigns.js` actual soporta múltiples. El nuevo schema solo define uno.

---

## 5. `backend/src/services/campaignDistributionService.js`

### Columnas que usa hoy vs nuevo schema

| Uso actual | Columna/tabla actual | En nuevo schema | ¿Roto? |
|---|---|---|---|
| Filtrar ofertas activas | `JobOffers.StatusId = 1` | `JobOffers.Status = 'active'` | **✘ Roto** |
| PK de oferta | `JobOffers.Id` | `JobOffers.Id` | ✅ Compatible |
| Insertar en CampaignChannels | `OfferId, ChannelId, AllocatedBudget, AllocatedTarget, CurrentCPA, BidAmount, QualityScore, ConversionRate, Status, AutoOptimization` | Solo: `CampaignId, ChannelId, Budget, BidStrategy, Status, Config` | **✘ Roto** — schema completamente diferente |
| JOIN CampaignChannels→JobOffers | `cc.OfferId = jo.Id` | No existe OfferId en CampaignChannels | **✘ Roto** |
| `CampaignSegments` | tabla intermedia | No existe | **✘ Roto** |
| Leer Segments.Filters | vía Segments query | Filters → FilterDefinition | **✘ Roto** |

### Cambios necesarios

```
campaignDistributionService.js — REESCRITURA PARCIAL

  La lógica de negocio (calcular distribución, CPA, budget por oferta)
  se CONSERVA. Solo cambia el contrato con la base de datos.

  getOffersFromSegment():
    - StatusId = 1 → Status = 'active' (o StatusId si se mantiene compatibilidad temporal)
    - Leer Segments.Filters → Segments.FilterDefinition
    - parseFilters(row.Filters) → row.FilterDefinition ya es objeto JSONB
    - Eliminar SQL Server hints: WITH (READPAST)
    - Migrar a Supabase nativo

  createCampaignChannels():
    - Schema actual: OfferId, ChannelId, AllocatedBudget, AllocatedTarget, CurrentCPA, etc.
    - Schema nuevo:  CampaignId, ChannelId, Budget, BidStrategy, Status, Config
    - Los campos detallados por oferta (AllocatedBudget, CPA, etc.) van a DistributionItems
      cuando se ejecuta la distribución real, no en CampaignChannels
    - Reescribir para insertar en CampaignChannels + DistributionRuns/DistributionItems

  getCampaignDistributionDetail():
    - JOIN CampaignChannels cc / JOIN JobOffers jo ON cc.OfferId = jo.Id
    - Nuevo: JOIN DistributionItems di / JOIN JobOffers jo ON di.JobOfferId = jo.Id
```

---

## 6. `backend/src/routes/connections.js`

### Impacto: BAJO

```
connections.js:
  L880 → supabase.from('JobOffers').select('*').eq('ConnectionId', ...)
          ConnectionId EXISTE en nuevo schema → ✅ compatible

  Los campos que lee (ExternalId, Title, CompanyName, City, etc.)
  EXISTEN en nuevo schema → ✅ compatible

  El único campo que puede fallar: JobTitle (no está en nuevo schema)
  Acción: eliminar JobTitle del dbToSourceMapping (L895)
```

---

## 7. Tabla resumen: columnas por ruta

### `Campaigns` — columnas actuales vs nuevo schema

| Columna actual | En nuevo schema | Acción |
|---|---|---|
| Id | Id | ✅ igual |
| Name | Name | ✅ igual |
| Description | Description | ✅ igual |
| SegmentId | SegmentId | ✅ igual |
| UserId | UserId | ✅ igual |
| StartDate | StartDate | ✅ igual |
| EndDate | EndDate | ✅ igual |
| Status | Status | ✅ igual |
| CreatedAt | CreatedAt | ✅ igual |
| UpdatedAt | UpdatedAt | ✅ igual |
| **Channels** | **❌ eliminado** | Mover a CampaignChannels |
| **DistributionType** | **❌ eliminado** | Mover a Config en CampaignChannels |
| **BidStrategy** | **❌ eliminado** | Mover a CampaignChannels.BidStrategy |
| **ManualBid** | **❌ eliminado** | Mover a CampaignChannels.Config |
| **Priority** | **❌ eliminado** | Mover a CampaignChannels.Config |
| **AutoOptimization** | **❌ eliminado** | Mover a CampaignChannels.Config |
| **MaxCPA** | **❌ eliminado** | Mover a CampaignChannels.Config |
| **TargetApplications** | **❌ eliminado** | Mover a CampaignChannels.Config |
| Budget | BudgetTotal | ⚠️ renombrar |
| — | BudgetCurrency | ✅ nuevo |
| — | Objective | ✅ nuevo |
| — | CreatedByUserId | ✅ nuevo |

### `Segments` — columnas actuales vs nuevo schema

| Columna actual | En nuevo schema | Acción |
|---|---|---|
| Id | Id | ✅ igual |
| Name | Name | ✅ igual |
| Description | Description | ✅ igual |
| UserId | UserId | ✅ igual |
| Status | Status | ✅ igual |
| CreatedAt | CreatedAt | ✅ igual |
| UpdatedAt | UpdatedAt | ✅ igual |
| **Filters** | **FilterDefinition** | ⚠️ renombrar + tipo TEXT→JSONB |
| **OfferCount** | **❌ eliminado** | Calcular on-the-fly |
| **Campaigns** (count) | **❌ eliminado** | Calcular on-the-fly |
| — | Type | ✅ nuevo |
| — | CreatedByUserId | ✅ nuevo |

### `JobOffers` — columnas actuales vs nuevo schema

| Columna actual | En nuevo schema | Acción |
|---|---|---|
| **OfferId** | **Id** | ⚠️ renombrar PK |
| **StatusId** (INT) | **Status** (VARCHAR) | ⚠️ cambiar tipo |
| UserId (UUID) | UserId (BIGINT) | ✅ corregido |
| Title, CompanyName, City, etc. | igual | ✅ igual |
| Description | DescriptionHtml + DescriptionText | ⚠️ dividir |
| ExternalId | ExternalId | ✅ igual |
| JobTitle | **❌ eliminado** | Mover a Title si es duplicado |
| TitleId, AreaId, DegreeId... (60+ cols) | **❌ eliminados** | Legacy SQL Server |
| — | Status (string), Language, RemotePolicy, etc. | ✅ nuevos |

---

## 8. Tabla oculta descubierta: `CampaignSegments`

`campaigns.js` y `segments.js` usan una tabla `CampaignSegments` que **no aparece en ningún schema SQL** del repo (solo en `bootstrap.js` en comentarios) y **no fue auditada en Supabase**.

```
Columnas esperadas por el código:
  CampaignId, SegmentId, BudgetAllocation, Weight, CreatedAt, UpdatedAt

Uso:
  - Permite que una campaña tenga múltiples segmentos
  - campaigns.js la usa en: CREATE, GET, activate, repopulate-channels
  - segments.js la usa en: detail (para listar campañas de un segmento)
```

**Pregunta crítica para Codex:** ¿El nuevo modelo soporta una campaña con múltiples segmentos, o se simplifica a uno? Esto impacta si `CampaignSegments` se añade al SQL propuesto o si se rediseña como `Campaigns.SegmentIds[]` (array) o como FK simple.

---

## 9. Orden recomendado: ¿código primero o schema primero?

**Recomendación: código primero.**

### Por qué código primero

1. El nuevo schema rompe funcionalidad activa. Si se ejecuta el SQL sin código adaptado, el backend falla inmediatamente para los usuarios.
2. Los cambios de código pueden estar listos y probados en local con el schema actual (usando el schema anterior como red de seguridad).
3. Una vez que el código esté listo y el SQL aprobado, se ejecutan juntos en una ventana de mantenimiento.
4. Permite hacer code review del nuevo código antes de comprometer el schema.

### Secuencia propuesta

```
Semana actual (análisis)
  [x] Este documento — análisis completo

Semana próxima (código)
  [ ] Migrar segments.js a Supabase nativo (todo pool.request() eliminado)
  [ ] Migrar campaigns.js a Supabase nativo (columnas nuevas, CampaignChannels)
  [ ] Migrar campaignDistributionService.js (StatusId → Status, OfferId → Id)
  [ ] jobOffers.js ya migrado — solo ajustes menores (StatusId → Status, OfferId → Id en promo filter)
  [ ] Decidir CampaignSegments: ¿un segmento por campaña o mantener tabla?

Ventana de migración (schema + código juntos)
  [ ] Verificar backup de Users, Connections, Campaigns, Segments
  [ ] Ejecutar proposed-clean-domain-schema.sql por fases
  [ ] Verificar counts post-migración
  [ ] Deploy del código nuevo
  [ ] Smoke tests: login, GET /job-offers, GET /api/segments, GET /api/campaigns
```

---

## 10. ¿Se necesita una fase intermedia de compatibilidad?

**Para la mayoría de los módulos: no.**

Los módulos ya migrados o por migrar (auth, jobOffers) no necesitan shim. El schema nuevo es lo suficientemente diferente que un shim haría el código más complejo, no más simple.

**Excepción: `Channels` en Campaigns.**

El frontend actual espera `campaign.Channels` como array de strings `["jooble", "talent"]`. Con el nuevo schema, los canales vienen de `CampaignChannels` como array de objetos `[{id:1, code:"jooble", name:"Jooble"}]`. Aquí sí puede ser útil un shim temporal en el GET response:

```javascript
// Shim temporal en GET /api/campaigns
const channelsForFrontend = campaign.campaignChannels?.map(cc => cc.channel?.Code) || [];
res.json({ ...campaign, Channels: channelsForFrontend });  // mantener contrato frontend
```

Esto permite que el frontend siga funcionando sin cambios mientras se adapta gradualmente.

---

## 11. Riesgos y decisiones pendientes

| Riesgo | Probabilidad | Impacto | Qué hacer |
|---|---|---|---|
| `CampaignSegments` no existe en Supabase (no auditada) | Media | Alto | Verificar en Supabase SQL Editor antes de ejecutar schema |
| Frontend depende de `Channels` como string array | Alta | Medio | Shim temporal en GET /api/campaigns |
| Multi-segmento por campaña sin `CampaignSegments` | Alta | Medio | Decidir: un segmento o tabla CampaignSegments en nuevo schema |
| `Budget` → `BudgetTotal` renaming rompe frontend | Media | Medio | Mantener `Budget` como alias o parchear frontend |
| `UserChannelCredentials.EncryptedCredentials` → `ChannelCredentials.CredentialsEncrypted` | Alta | Alto | Actualizar activate endpoint ANTES de schema change |
| `StatusId` → `Status` en queries de estimación | Alta | Medio | Actualizar segments.js y campaignDistributionService.js antes |
