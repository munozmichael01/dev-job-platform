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
| Campañas del segmento | `CampaignSegments` JOIN | `CampaignSegments` existe — misma tabla, misma lógica | ✅ Compatible — solo migrar a Supabase nativo |
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

  L238 → DELETE check: FROM Campaigns WHERE SegmentId=@Id
         Nuevo: Campaigns no tiene SegmentId — el check de integridad lo da el CASCADE en CampaignSegments
         Cambio: eliminar este check o reemplazar por .from('CampaignSegments').select().eq('SegmentId', id)

  L407-412 → CampaignSegments JOIN — CONSERVAR esta lógica
             CampaignSegments SÍ existe en el nuevo schema (tabla M:N formal)
             Solo migrar de pool.request() a Supabase nativo

  L433-436 → JobOffers WITH (READPAST) → eliminar hint

  L494 → INSERT INTO Segments (...UserId omitido en duplicate...) → añadir UserId
```

---

## 4. `backend/src/routes/campaigns.js`

### Columnas que usa hoy vs nuevo schema

| Uso actual | Columna/tabla actual | En nuevo schema | ¿Roto? |
|---|---|---|---|
| Canales de la campaña | `Campaigns.Channels` (JSON TEXT) | No existe — `CampaignChannels` tabla | **✘ Roto** — columna eliminada |
| Segmentos múltiples | `CampaignSegments` tabla | `CampaignSegments` existe — misma estructura | ✅ Compatible — solo migrar a Supabase nativo |
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
    - Eliminar JOIN Segments ON c.SegmentId (Campaigns ya no tiene SegmentId)
    - Conservar lógica de CampaignSegments — ahora viene de JOIN CampaignSegments cs ON cs.CampaignId = c.Id
    - Calcular SegmentOffers via COUNT de JobOffers con FilterDefinition del segmento (Segments.OfferCount eliminado)
    - Channels: leer de CampaignChannels JOIN DistributionChannels en vez de JSON
    - Aplicar shim: devolver Channels:["jooble"] + Budget:<BudgetTotal> para compat frontend (Sección 10)

  L88-258 (POST /) →
    - Campaigns nuevo tiene: Name, Description, BudgetTotal, BudgetCurrency,
                              StartDate, EndDate, Status, UserId, CreatedByUserId
    - NO SegmentId en Campaigns — los segmentos van en CampaignSegments (M:N)
    - Campos de distribución movidos: DistributionType, BidStrategy, ManualBid,
      Priority, AutoOptimization, MaxCPA → CampaignChannels.Config JSONB
    - Channels JSON → insertar rows en CampaignChannels con FK a DistributionChannels
    - CampaignSegments → CONSERVAR la lógica de inserción múltiple (ya existe en el código)
      Solo migrar de pool.request() a Supabase nativo
    - Budget en JSON response → devolver tanto "Budget" como alias de "BudgetTotal"
      para no romper frontend durante la transición

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

**Decisión tomada (2026-06-03):** Multi-segmento por campaña es el modelo canónico. `CampaignSegments` está en el nuevo schema. `Campaigns` no tiene `SegmentId`. La lógica de inserción múltiple de `campaigns.js` se conserva — solo migrar a Supabase nativo.

---

## 5. `backend/src/services/campaignDistributionService.js`

### Columnas que usa hoy vs nuevo schema

| Uso actual | Columna/tabla actual | En nuevo schema | ¿Roto? |
|---|---|---|---|
| Filtrar ofertas activas | `JobOffers.StatusId = 1` | `JobOffers.Status = 'active'` | **✘ Roto** |
| PK de oferta | `JobOffers.Id` | `JobOffers.Id` | ✅ Compatible |
| Insertar en CampaignChannels | `OfferId, ChannelId, AllocatedBudget, AllocatedTarget, CurrentCPA, BidAmount, QualityScore, ConversionRate, Status, AutoOptimization` | Solo: `CampaignId, ChannelId, Budget, BidStrategy, Status, Config` | **✘ Roto** — schema completamente diferente |
| JOIN CampaignChannels→JobOffers | `cc.OfferId = jo.Id` | No existe OfferId en CampaignChannels | **✘ Roto** |
| `CampaignSegments` | tabla intermedia M:N | Existe — misma estructura | ✅ Compatible — solo migrar a Supabase nativo |
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

## 8. `CampaignSegments` — decisión tomada (2026-06-03)

`campaigns.js` y `segments.js` usan `CampaignSegments`. Auditada en Supabase: **puede no existir aún** (solo en `bootstrap.js` en comentarios). La decisión de dominio está tomada:

**Decisión:** `CampaignSegments` ES parte del nuevo schema limpio. Multi-segmento por campaña es el modelo canónico.

```
Tabla nueva en proposed-clean-domain-schema.sql:
  CampaignSegments (
    Id SERIAL PK,
    CampaignId → Campaigns.Id CASCADE,
    SegmentId  → Segments.Id  CASCADE,
    BudgetAllocation DECIMAL(5,2) DEFAULT 100.0,  -- % del presupuesto
    Weight DECIMAL(5,2) DEFAULT 1.0,
    CreatedAt, UpdatedAt,
    UNIQUE (CampaignId, SegmentId)
  )
```

**Impacto en código:** el código actual que usa `CampaignSegments` es **compatible** con el nuevo schema. Los cambios necesarios son solo de migración a Supabase nativo (eliminar `pool.request()`), no de lógica de negocio.

**Verificar en Supabase antes de ejecutar:**
```sql
SELECT COUNT(*) FROM "CampaignSegments";
```
Si la tabla no existe, el CREATE en el SQL propuesto la crea desde cero. Si existe, el DROP CASCADE en Campaigns la eliminará primero.

---

## 9. Orden recomendado: ¿código primero o schema primero?

**El schema y el código no se despliegan de forma aislada. Se coordinan en una ventana de mantenimiento controlada.**

### Secuencia aprobada

```
PASO 1 — Preparar código en branch (antes de tocar producción)
  [ ] Crear branch: feat/clean-domain-migration
  [ ] Migrar segments.js a Supabase nativo:
        Filters → FilterDefinition, OfferCount eliminado, CampaignSegments conservado
  [ ] Migrar campaigns.js a Supabase nativo:
        Channels JSON → CampaignChannels JOIN, CampaignSegments M:N, shims activos
  [ ] Migrar campaignDistributionService.js:
        StatusId → Status, CampaignChannels sin OfferId, DistributionItems para per-offer
  [ ] Ajustar jobOffers.js:
        StatusId → Status en filtros y mapOffer, OfferId → Id en promo filter
  [ ] Revisar que todos los shims estén implementados (Channels, Budget, segments)
  [ ] Code review del branch — no mergear hasta que el SQL esté aprobado

PASO 2 — Revisar y aprobar SQL final
  [ ] Revisar proposed-clean-domain-schema.sql con Codex
  [ ] Confirmar counts actuales en Supabase (Users=15, Connections=89, etc.)
  [ ] Confirmar JobOffers COUNT = 0 (prerequisito del DROP)
  [ ] Backup manual de Users, Connections, Campaigns, Segments desde Supabase dashboard
  [ ] Aprobar SQL explícitamente antes de continuar

PASO 3 — Ventana de migración (schema + deploy en secuencia inmediata)
  [ ] Ejecutar proposed-clean-domain-schema.sql fase por fase en Supabase SQL Editor
  [ ] Verificar counts post-migración:
        Users=15, Connections=89, JobOffers=0, Segments=0, Campaigns=0
        DistributionChannels=7, Segments_bak=17, Campaigns_bak=15
  [ ] Ejecutar NOTIFY pgrst, 'reload schema'
  [ ] Desplegar el código del branch inmediatamente (no dejar ventana sin código compatible)

PASO 4 — Smoke tests post-deploy
  [ ] POST /api/auth/login → 200
  [ ] GET /api/auth/verify → 200
  [ ] GET /job-offers → 200, total: 0, sin 500
  [ ] GET /api/segments → 200, array vacío (segmentos archivados, no migrados)
  [ ] GET /api/campaigns → 200, array vacío (campañas archivadas, no migradas)
  [ ] POST /api/segments (crear uno nuevo) → 201
  [ ] POST /api/campaigns (crear una nueva) → 201
```

### Principio

Schema y código son un cambio atómico desde la perspectiva del sistema. Si se ejecuta el SQL sin el código nuevo, el backend falla para todos los usuarios activos. Si se despliega el código sin el SQL, nada funciona tampoco. La ventana de mantenimiento garantiza que ambos cambios ocurran en secuencia inmediata y controlada.

---

## 10. Fase intermedia de compatibilidad — shims aprobados

**Decisión (2026-06-03):** durante la transición, el backend devuelve shims para no romper el frontend inmediatamente.

### Shim 1: `Channels` como array de strings

```javascript
// GET /api/campaigns — en el response builder
const channelCodes = campaignChannels.map(cc => cc.distributionChannel?.Code || cc.channelCode);
res.json({
  ...campaign,
  Channels: channelCodes,          // ["jooble", "talent"] — shim para frontend
  campaignChannels: campaignChannels // nuevo campo con FK completo para futuro
});
```

### Shim 2: `Budget` como alias de `BudgetTotal`

```javascript
// GET /api/campaigns — en el response builder
res.json({
  ...campaign,
  Budget: campaign.BudgetTotal,    // alias shim para frontend
  BudgetTotal: campaign.BudgetTotal // campo canónico
});
```

### Shim 3: `segments` derivado de CampaignSegments

```javascript
// GET /api/campaigns — en el response builder
// Hoy: segments vienen de CampaignSegments JOIN Segments
// El campo "segment" (singular) que el frontend usa como display name:
const segmentNames = campaignSegments.map(cs => cs.segment?.Name).join(', ');
res.json({
  ...campaign,
  segment: segmentNames,           // shim: nombre legible de segmentos
  segments: campaignSegments       // nuevo campo estructurado
});
```

Estos shims se eliminan cuando el frontend sea actualizado para leer los campos nuevos. Se documentan aquí para que no queden como "magia" en el código.

---

## 11. Riesgos y decisiones pendientes

| Riesgo | Probabilidad | Impacto | Estado | Qué hacer |
|---|---|---|---|---|
| `CampaignSegments` no existe en Supabase | Media | Bajo | ✅ Resuelto — CREATE en schema nuevo la crea si no existe | Verificar COUNT antes de ejecutar |
| Frontend depende de `Channels` como string array | Alta | Medio | ✅ Resuelto — shim aprobado en Sección 10 | Implementar shim en GET /api/campaigns |
| Multi-segmento sin `CampaignSegments` | Alta | Medio | ✅ Resuelto — CampaignSegments está en schema nuevo | Lógica de código se conserva |
| `Budget` → `BudgetTotal` rompe frontend | Alta | Medio | ✅ Resuelto — shim aprobado en Sección 10 | Implementar alias Budget=BudgetTotal en response |
| `UserChannelCredentials.EncryptedCredentials` → `ChannelCredentials.CredentialsEncrypted` | Alta | Alto | ⚠️ Pendiente | Actualizar activate endpoint ANTES del schema change |
| `StatusId` → `Status` en queries de estimación | Alta | Medio | ⚠️ Pendiente | Actualizar segments.js y campaignDistributionService.js |
| `Campaigns.SegmentId` esperado por algún código no auditado | Baja | Medio | ⚠️ Verificar | Búsqueda global: `grep -r "SegmentId" backend/src/` |
