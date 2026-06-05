# Auditoría de Contratos UI → Backend
## Tarea 3.5: Compatibilidad post-migración de schema

**Fecha:** 2026-06-03
**Status:** AUDITORÍA — sin tocar frontend

---

## Leyenda

| Símbolo | Significado |
|---|---|
| ✅ | Compatible — no requiere cambio |
| ⚠️ | Riesgo menor — funciona pero con advertencia |
| ✘ | **Roto** — requiere cambio en backend antes de desplegar |

---

## Resumen ejecutivo

| Pantalla | Estado global | Bloqueantes |
|---|---|---|
| `/conexiones` | ✘ Roto | `POST /:id/import` usa XMLProcessor con schema viejo |
| `/conexiones/:id/mapeo` | ✘ Roto | `GET /:id/mapping` lee `ClientFieldMappings` (no existe) |
| `/ofertas` | ⚠️ Riesgo | `updateOfferStatus` envía `status: number`, backend acepta ambos |
| `/segmentos` | ✅ Compatible | Codex migró segments.js — schema nuevo compatible |
| `/campanas` | ⚠️ Shim activo | `Budget` y `Channels` ya tienen shim en campaigns.js |
| `/credenciales` | ✅ Compatible | userCredentials.js usa ChannelCredentials (tabla nueva) |
| `/` (dashboard) | ✅ Compatible | metrics.js usa BudgetTotal, CampaignChannels, Supabase nativo |

---

## 1. `/conexiones` — page.tsx

### Endpoints que llama

| Método | Endpoint | Payload | Response esperado | Estado |
|---|---|---|---|---|
| GET | `/api/connections` | — | `[{id, name, type, url, status, lastSync, importedOffers, UserId, ...}]` | ✅ Supabase nativo |
| POST | `/api/connections` | `{name, type, url, frequency, ...}` | `{id, name, ...}` | ✅ Compatible |
| DELETE | `/api/connections/:id` | — | `{message: "..."}` | ✅ Compatible |
| POST | `/api/connections/:id/import` | — | `{success, message, result: {imported, errors}}` | **✘ Roto** |
| POST | `/api/connections/:id/upload` | FormData `file` | `{success, imported, errors}` | ⚠️ No migrado |

### Detalle del roto

**`POST /api/connections/:id/import`:**
- Crea `XMLProcessor(connection)` y llama `.process()`
- `XMLProcessor.saveOfferToDatabase()` escribe columnas que NO existen en nuevo schema:
  `StatusId, JobTitle, BudgetSpent, ApplicationsReceived, Budget, ApplicationsGoal, Source`
- `onConflict: 'ExternalId,ConnectionId'` — el UNIQUE nuevo es `(UserId, ConnectionId, ExternalId)`
- `archiveOldOffers()` usa SQL Server temp tables (`#ActiveIds`) via `pool.request()`
- Al final actualiza `Connections` via `pool.request()` (puede fallar)

**`POST /api/connections/:id/upload`:**
- Usa `xmlFileProcessor.js` que tiene el mismo problema de schema
- No migrado a nuevo schema

### Cambio mínimo en backend para preservar contrato

```
POST /api/connections/:id/import
  OPCIÓN A (recomendada): 
    Cambiar connections.js para que llame a XMLImporter (nuevo)
    en vez de XMLProcessor (legacy) cuando el tipo es XML.
    El contrato de response se preserva:
      { success: true, message: "...", result: { imported, errors } }
    XMLImporter ya devuelve stats = { total, inserted, updated, failed, archived }
    Solo mapear stats → { imported: stats.inserted + stats.updated, errors: stats.failed }

  OPCIÓN B (parche rápido):
    Dejar XMLProcessor pero actualizar los campos que escribe
    para que coincidan con el nuevo schema JobOffers.
    Más arriesgado, acumula deuda.
```

---

## 2. `/conexiones/:id/mapeo` — mapeo/page.tsx

### Endpoints que llama

| Método | Endpoint | Payload | Response esperado | Estado |
|---|---|---|---|---|
| GET | `/api/connections/:id` | — | `{id, name, type, url, ...}` | ✅ Compatible |
| GET | `/api/connections/:id/fields` | — | `{success, fields: [{name, type, sample}]}` | ✅ Compatible |
| GET | `/api/connections/:id/mappings` | — | `[{ConnectionId, SourceField, TargetField, TransformationType, ...}]` | ✅ Supabase → FieldMappings |
| GET | `/api/connections/:id/mapping` | — | `[{ConnectionId, SourceField, TargetField, TransformationType, ...}]` | **✘ Roto** |
| POST | `/api/connections/:id/mappings` | `{mappings: [{sourceField, targetField, TransformationType}]}` | `{success, count, total}` | ✅ Compatible |
| POST | `/api/connections/:id/test-mapping` | `{mappings, sampleData}` | `{success, preview: [{original, mapped}]}` | ⚠️ Ver nota |
| PUT | `/api/connections/:id` | `{name, url, status, ...}` | `{id, name, ...}` | ✅ Compatible |

### Detalle del roto

**`GET /api/connections/:id/mapping`:**
```javascript
// connections.js línea 1083:
result = await pool.request()
  .query(`SELECT ... FROM ClientFieldMappings WHERE ConnectionId = @connectionId`)
```
- `ClientFieldMappings` **no existe en el nuevo schema**. La tabla en el nuevo schema es `FieldMappings`.
- El frontend llama AMBOS endpoints:
  - `GET /mappings` (línea 221 en mapeo/page.tsx) → lee de `FieldMappings` ✅
  - `GET /mapping` (línea 531, recarga post-save) → lee de `ClientFieldMappings` ✘
- La pantalla de mapeo usará el resultado de `/mapping` para mostrar el estado actual tras guardar.

### Cambio mínimo en backend

```
GET /api/connections/:id/mapping
  Cambiar para leer de FieldMappings (Supabase) en vez de ClientFieldMappings (pool.request).
  La response shape es la misma: array de {ConnectionId, SourceField, TargetField, TransformationType}
  
  Código nuevo (3 líneas):
    const { data } = await supabase
      .from('FieldMappings')
      .select('ConnectionId, SourceField, TargetField, TransformationType, TransformationConfig')
      .eq('ConnectionId', id)
      .order('TargetField');
    res.json(data || []);
```

**`POST /api/connections/:id/test-mapping`:**
- Línea 754: usa `pool.request()` internamente — puede fallar si llega a leer/escribir
- La lógica de test es transformación en memoria, no escribe a DB
- **⚠️ Riesgo bajo** — si el test-mapping solo transforma datos y no lee tablas, funcionará
- Verificar post-migración con un test manual

---

## 3. `/ofertas` — page.tsx

### Endpoints que llama

| Método | Endpoint | Payload | Response esperado | Estado |
|---|---|---|---|---|
| GET | `/job-offers` | `?q=&status=&location=&sector=&company=&externalId=&page=&limit=&sortBy=&sortOrder=` | `{success, data:[{id,title,company,sector,location,salary,status,...}], total, hasMore, pagination, stats, filters}` | ✅ Compatible |
| GET | `/job-offers/locations` | `?status=&sector=&company=&externalId=&q=` | `{success, data: string[]}` | ✅ Compatible |
| GET | `/job-offers/sectors` | `?status=&location=&company=&externalId=&q=` | `{success, data: string[]}` | ✅ Compatible |
| GET | `/job-offers/companies` | `?status=&location=&sector=&externalId=&q=` | `{success, data: string[]}` | ✅ Compatible |
| GET | `/job-offers/external-ids` | `?status=&location=&sector=&company=&q=` | `{success, data: string[]}` | ✅ Compatible |
| GET | `/job-offers/job-types` | — | `{success, data: string[]}` | ✅ Compatible |
| PUT | `/job-offers/:id/status` | `{status: number}` | `{success, message, data:{id, previousStatus, newStatus}}` | ⚠️ Ver nota |

### Nota sobre `updateOfferStatus`

La UI envía `status: number` (e.g. `status: 1`). El backend nuevo (`jobOffers.js`) hace:
```javascript
const nextStatus = normalizeStatus(req.body.status);
```
Y `normalizeStatus()` ya maneja enteros:
```javascript
if (typeof value === 'number') return ID_TO_STATUS[value] || null;
if (ID_TO_STATUS[Number(raw)]) return ID_TO_STATUS[Number(raw)];
```
**✅ Compatible** — la UI puede seguir enviando `status: 1` y el backend lo convierte a `'active'`.

La response incluye `newStatusId: statusId(nextStatus)` por retrocompatibilidad.

---

## 4. `/segmentos` — page.tsx

### Endpoints que llama

| Método | Endpoint | Payload | Response esperado | Estado |
|---|---|---|---|---|
| GET | `/api/segments` | — | `[{Id, Name, Description, FilterDefinition, Status, Type, ...}]` | ✅ Compatible |
| POST | `/api/segments/:id/recalculate` | — | `{success, data:{id, name, newCount, updatedAt}}` | ✅ Compatible |
| POST | `/api/segments/:id/duplicate` | `{name?}` | `{success, message, data:{...}}` | ✅ Compatible |
| DELETE | `/api/segments/:id` | — | 204 | ✅ Compatible |

**Observación:** La UI también tiene `getSegmentDetail` que llama `GET /api/segments/:id/detail`. Este endpoint en `segments.js` usa `CampaignSegments` JOIN — que Codex ya migró. Verificar post-migración.

---

## 5. `/campanas` — page.tsx

### Endpoints que llama

| Método | Endpoint | Payload | Response esperado | Estado |
|---|---|---|---|---|
| GET | `/api/campaigns` | — | `[{Id, Name, Status, Budget, Channels:string[], segments:[...], SegmentName, ...}]` | ⚠️ Shim activo |
| PATCH | `/api/campaigns/:id/status` | `{status: 'paused'\|'active'}` | `{success, message, campaignId, newStatus}` | ✅ Compatible |
| DELETE | `/api/campaigns/:id` | — | `{success, message}` o 204 | ✅ Compatible |
| POST | `/api/campaigns/:id/activate` | — | `{success, message, status, channels, offers}` | ⚠️ Ver nota |

### Shims activos en campaigns.js

Codex ya implementó los shims en `campaigns.js`:
```javascript
Budget: row.BudgetTotal,          // shim: UI espera 'Budget'
Channels: channelCodes,            // shim: UI espera array de strings
SegmentId: segments[0]?.segmentId, // shim: legacy frontend
SegmentName: segments[0]?.name,    // shim: legacy frontend
segments: [...],                   // nuevo campo estructurado
campaignChannels: [...]             // nuevo campo estructurado
```
**✅ El contrato UI está cubierto por los shims.**

### Nota sobre `activateCampaign`

`POST /api/campaigns/:id/activate` actualmente en `campaigns.js` usa:
- `pool.request()` para leer la campaña
- `UserChannelCredentials` (tabla que ya no existe) para obtener credenciales

**✘ Si el usuario activa una campaña, fallará** por:
1. `pool.request()` para leer Campaigns
2. Busca credenciales en `UserChannelCredentials` — reemplazada por `ChannelCredentials`

**Cambio mínimo necesario:**
```
POST /api/campaigns/:id/activate
  1. Migrar lectura de campaña a Supabase
  2. Cambiar búsqueda de credenciales de UserChannelCredentials → ChannelCredentials
     Columna: EncryptedCredentials → CredentialsEncrypted
     FK: ChannelId ahora es INTEGER (FK a DistributionChannels), no string
```

---

## 6. `/credenciales` — page.tsx

### Endpoints que llama

| Método | Endpoint | Payload | Response esperado | Estado |
|---|---|---|---|---|
| GET | `/api/credentials` | — | `{success, channels: [{channelId, channelCode, name, isActive, ...}]}` | ✅ Compatible |
| GET | `/api/credentials/channels` | — | `{success, channels: [{id, name, code, type}]}` | ✅ Compatible |
| GET | `/api/users/:userId/credentials/:channelId` | — | `{success, ...credentials}` | ✅ Compatible |
| POST | `/api/users/:userId/credentials/:channelId` | `{name, credentialsData, ...}` | `{success, message, data}` | ✅ Compatible |
| PUT | `/api/users/:userId/credentials/:channelId` | `{...}` | `{success, ...}` | ✅ Compatible |
| POST | `/api/users/:userId/credentials/:channelId/validate` | — | `{success, message}` | ✅ Compatible |

`userCredentials.js` ya usa `ChannelCredentials` (tabla del nuevo schema) con Supabase nativo. **Completamente compatible.**

---

## 7. `/` (Dashboard) — page.tsx

### Endpoints que llama

| Método | Endpoint | Payload | Response esperado | Estado |
|---|---|---|---|---|
| GET | `/api/campaigns` | — | `[{...}]` | ⚠️ Shim activo (ver /campanas) |
| GET | `/api/metrics/dashboard` | — | `{success, data:{budgetDistribution, applicationsDistribution, generalMetrics:{activeCampaigns, activeOffers, totalBudget}}}` | ✅ Compatible |
| GET | `/api/offers/stats` | — | `{success, data:{totalActiveOffers, offersInActiveCampaigns, unassignedOffers}}` | ✅ Compatible |

`metrics.js` ya usa `Campaigns.BudgetTotal`, `CampaignChannels` con JOIN a `DistributionChannels` — todo Supabase nativo y compatible con el nuevo schema.

---

## Resumen de cambios backend requeridos antes de deploy

### Bloqueantes (sin esto la UI se rompe)

| # | Endpoint | Archivo | Cambio |
|---|---|---|---|
| 1 | `GET /api/connections/:id/mapping` | `connections.js` L1083 | Reemplazar `pool.request()` sobre `ClientFieldMappings` con Supabase sobre `FieldMappings` |
| 2 | `POST /api/connections/:id/import` | `connections.js` L395 | Usar `XMLImporter` (nuevo) en vez de `XMLProcessor` (legacy) cuando tipo=XML |

### Importante (funciona pero con degradación)

| # | Endpoint | Archivo | Cambio |
|---|---|---|---|
| 3 | `POST /api/campaigns/:id/activate` | `campaigns.js` | Migrar lectura de campaña + cambiar `UserChannelCredentials` → `ChannelCredentials` |
| 4 | `POST /api/connections/:id/upload` | `connections.js` | Usar nuevo importer en vez de xmlFileProcessor legacy |

### No bloquean (ya funcionan con nuevo schema)

- `/api/connections` GET — Supabase nativo ✅
- `/api/connections/:id/mappings` GET/POST — Supabase + FieldMappings ✅
- `/api/connections/:id/fields` — solo parseo XML en memoria ✅
- `/job-offers` y todos sus filtros — jobOffers.js migrado ✅
- `/api/segments` — segments.js migrado por Codex ✅
- `/api/campaigns` GET con shims — campaigns.js migrado por Codex ✅
- `/api/metrics/dashboard` — metrics.js Supabase nativo ✅
- `/api/offers/stats` — offers.js Supabase nativo ✅
- `/api/credentials` y `/api/credentials/channels` — userCredentials.js ✅

---

## Orden de trabajo recomendado antes de ejecutar SQL

```
1. [Claude] Fix GET /api/connections/:id/mapping → FieldMappings vía Supabase
2. [Claude] Wire POST /api/connections/:id/import → XMLImporter (nuevo) para XML
3. [Claude] Fix POST /api/campaigns/:id/activate → Supabase + ChannelCredentials
4. Ejecutar SQL migration
5. Smoke tests (script preparado en backend/scripts/smoke-test-post-migration.sh)
```
