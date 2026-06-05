# Schema Migration Audit
## Estado actual, propuesta y riesgos

**Fecha:** 2026-06-03
**Autor:** Claude Code (auditoría sobre Supabase live + código)
**Status:** PROPUESTA — sin ejecutar

---

## 1. Diagnóstico del schema actual

### Tablas existentes y estado

| Tabla | Filas | Estado | Notas |
|---|---|---|---|
| `Users` | 15 | Conservar + ampliar | Id BIGINT ✓, sin Phone/PasswordHash en live (sí en schema SQL) |
| `Connections` | 89 | Conservar + renombrar | Naming inconsistente (snake_case PK, PascalCase resto) |
| `Campaigns` | 15 | Conservar + ampliar | UserId BIGINT ✓, Channels es JSON string crudo |
| `Segments` | 17 | Conservar + ampliar | Filters JSON válido, OfferCount=0 para todos |
| `JobOffers` | 0 | **REEMPLAZAR** | PK=OfferId, UserId=UUID (mismatch), schema heredado SQL Server |
| `FieldMappings` | 3 | Conservar + ampliar | ConnectionId=2099 (no existe en Connections) |
| `UserChannelCredentials` | 0 | **REEMPLAZAR** | Sin FK a canales, renombrar a ChannelCredentials |
| `CampaignChannels` | 0 | **REEMPLAZAR** | Sin FK a DistributionChannels |
| `Clients` | ≈0 | Evaluar | schema-supabase-fixed.sql no la incluye como tabla core |
| `Mappings`, `Metrics`, etc. | 0 | Vacías, sin datos críticos | Reemplazar con modelo nuevo |

### Hallazgos críticos

**A. JobOffers: schema incompatible desde origen**
- PK es `OfferId` (SERIAL), no `Id`
- `UserId` es tipo `UUID` — incompatible con `Users.Id` (BIGINT)
- Tiene >60 columnas heredadas de SQL Server (`TitleId`, `AreaId`, `DegreeId`, etc.)
- Está vacía — no hay riesgo de pérdida de datos

**B. Dos sistemas de naming conviven**
- `Connections`: PK `id` (lowercase), resto PascalCase
- `Users`, `Campaigns`, `Segments`: PascalCase consistente
- Causa: tablas creadas en momentos distintos con distintos scripts

**C. FieldMappings apunta a ConnectionId=2099 inexistente**
- 3 filas con `ConnectionId=2099` — no hay Connections con id=2099
- Datos de testing/desarrollo, no de producción

**D. Campaigns.Channels es JSON string sin FK**
- `"Channels": '["jooble"]'` — no referencia a tabla de canales
- CampaignChannels existe pero tiene 0 filas
- El código actual en `campaigns.js` usa este JSON crudo

**E. Users no tiene Phone ni PasswordHash en el schema live**
- El schema SQL los define, la tabla live no los muestra en `select *`
- Probablemente existen pero PostgREST no los expone (schema cache desactualizada)
- Validar con: `\d "Users"` en Supabase SQL Editor

**F. PostgREST schema cache desactualizada**
- `select('Id')` sobre JobOffers falla con "column does not exist"
- `select('*')` funciona — el problema es la resolución de columna en la cache
- Solución: `NOTIFY pgrst, 'reload schema'` después de cualquier DDL

---

## 2. Qué tablas conservar

| Tabla | Decisión | Motivo |
|---|---|---|
| `Users` | ✔ Conservar + ampliar | 15 usuarios activos, auth JWT depende de Id BIGINT |
| `Connections` | ✔ Conservar | 89 conexiones con URLs reales (feed Turijobs, etc.) |
| `Campaigns` | ✔ Conservar | 15 campañas, estructura reutilizable con ajustes |
| `Segments` | ✔ Conservar | 17 segmentos, Filters JSON válido |
| `FieldMappings` | ✔ Conservar + ampliar | 3 filas (testing), estructura útil para el modelo nuevo |

---

## 3. Qué tablas reemplazar

| Tabla | Decisión | Motivo |
|---|---|---|
| `JobOffers` | ✘ DROP + recrear | 0 filas, schema incompatible (UUID FK, OfferId PK, 60+ cols legacy) |
| `CampaignChannels` | ✘ DROP + recrear | 0 filas, sin FK a DistributionChannels |
| `UserChannelCredentials` | ✘ DROP + recrear | 0 filas, renombrar a ChannelCredentials con FK correcto |

---

## 4. Qué tablas nuevas crear

| Tabla | Fase | Propósito |
|---|---|---|
| `RawJobRecords` | 3 | Guardar payload original antes de transformar |
| `DistributionChannels` | 5 | Catálogo de canales (jooble, talent, linkedin, etc.) |
| `DistributionRuns` | 6 | Ejecución de distribución por campaña/canal |
| `DistributionItems` | 6 | Resultado por oferta/canal en cada run |
| `ChannelCredentials` | 7 | Reemplaza UserChannelCredentials con FK correctas |
| `AgentRuns` | 9 | Persiste ejecuciones de agentes IA |
| `AgentRecommendations` | 9 | Recomendaciones IA pendientes de revisión humana |

**Tablas diferidas** (post-validación ingesta/distribución):
- `Candidates`, `Applications`, `Interviews` — Fase 2 del roadmap
- `Organizations` — cuando se active multi-tenant real

---

## 5. Incompatibilidades con la auth actual

### Críticas (bloquean funcionalidad)

| Incompatibilidad | Impacto | Solución propuesta |
|---|---|---|
| `JobOffers.UserId = UUID` vs `Users.Id = BIGINT` | POST /job-offers falla, filtro por usuario silencioso | Recrear JobOffers con UserId BIGINT FK |
| `FieldMappings.ConnectionId = 2099` inexistente | 3 filas huérfanas | Limpiar antes de añadir FK formal |
| `CampaignChannels` sin FK a DistributionChannels | Imposible relacionar canal con credencial | Recrear con FK correcto |

### Menores (no bloquean, pero generan deuda)

| Incompatibilidad | Impacto | Solución propuesta |
|---|---|---|
| `Connections.id` lowercase vs resto PascalCase | Inconsistencia en código | No cambiar ahora — breaking change sin valor |
| `Campaigns.Channels` JSON string en vez de FK | Difícil indexar/filtrar por canal | Migrar a CampaignChannels nuevo (dato redundante) |
| PostgREST cache desactualizada | `select('Id')` falla en JobOffers | `NOTIFY pgrst, 'reload schema'` post-DDL |

---

## 6. SQL propuesto

Ver [`backend/scripts/proposed-clean-schema.sql`](../backend/scripts/proposed-clean-schema.sql)

Estructura por fases:
- **Fase 1**: ALTER TABLE Users (añadir Phone, PasswordHash, OrganizationId si no existen)
- **Fase 2**: DROP + CREATE JobOffers (vacía → seguro)
- **Fase 3**: CREATE RawJobRecords
- **Fase 4**: ALTER TABLE Segments (añadir FilterDefinition, Type, CreatedByUserId)
- **Fase 5**: ALTER TABLE Campaigns + CREATE DistributionChannels + CREATE CampaignChannels
- **Fase 6**: CREATE DistributionRuns + DistributionItems
- **Fase 7**: DROP + CREATE ChannelCredentials
- **Fase 8**: ALTER TABLE FieldMappings
- **Fase 9**: CREATE AgentRuns + AgentRecommendations
- **Fase 10**: NOTIFY pgrst

---

## 7. Plan de ejecución por fases

```
Semana 1 — Pre-migración
  [ ] Validar conteo de filas: Users=15, Connections=89, Campaigns=15, Segments=17, JobOffers=0
  [ ] Backup manual de Users, Connections, Campaigns, Segments desde Supabase dashboard
  [ ] Ejecutar \d "Users" en SQL Editor para confirmar columnas reales
  [ ] Confirmar que Phone y PasswordHash existen en Users (o añadirlos)
  [ ] Decidir si los 17 segmentos y 15 campañas se conservan o se limpian
  [ ] Decidir si las 3 filas de FieldMappings se limpian (ConnectionId=2099 no existe)

Semana 1 — Migración (sólo si pre-migración aprobada)
  [ ] Ejecutar Fase 1 (ALTER Users)
  [ ] Verificar Users intacto
  [ ] Ejecutar Fase 2 (DROP + CREATE JobOffers)
  [ ] Ejecutar Fase 3 (CREATE RawJobRecords)
  [ ] Ejecutar Fase 4 (ALTER Segments)
  [ ] Verificar Segments intacto (17 filas, FilterDefinition poblada)
  [ ] Ejecutar Fase 5 (ALTER Campaigns + DistributionChannels + CampaignChannels)
  [ ] Verificar Campaigns intacto (15 filas)
  [ ] Verificar DistributionChannels seedeada (7 canales)
  [ ] Ejecutar Fase 6 (DistributionRuns + DistributionItems)
  [ ] Ejecutar Fase 7 (ChannelCredentials)
  [ ] Ejecutar Fase 8 (ALTER FieldMappings)
  [ ] Ejecutar Fase 9 (AgentRuns + AgentRecommendations)
  [ ] Ejecutar Fase 10 (NOTIFY pgrst)

Post-migración
  [ ] Correr GET /job-offers → debe ser 200 con total=0, no 500
  [ ] Correr GET /api/auth/verify → debe funcionar
  [ ] Confirmar que columnas de JobOffers son accesibles via select('Id')
  [ ] Confirmar que UserId en JobOffers acepta BIGINT
  [ ] Hacer primer insert de prueba en JobOffers y limpiar
```

---

## 8. Validaciones antes de correr la migración

### Checks de datos (ejecutar en Supabase SQL Editor)

```sql
-- 1. Conteos base
SELECT 'Users' as t, COUNT(*) FROM "Users"
UNION SELECT 'Connections', COUNT(*) FROM "Connections"
UNION SELECT 'Campaigns', COUNT(*) FROM "Campaigns"
UNION SELECT 'Segments', COUNT(*) FROM "Segments"
UNION SELECT 'JobOffers', COUNT(*) FROM "JobOffers";
-- Expected: 15, 89, 15, 17, 0

-- 2. Confirmar que Users.Id es BIGINT (auth depende de esto)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'Users' AND column_name = 'Id';
-- Expected: Id, bigint

-- 3. Confirmar JobOffers.UserId es UUID (el bug)
SELECT column_name, data_type FROM information_schema.columns
WHERE table_name = 'JobOffers' AND column_name = 'UserId';
-- Expected: UserId, uuid  ← confirmar antes de DROP

-- 4. FieldMappings con ConnectionId inexistente
SELECT fm."ConnectionId", COUNT(*) FROM "FieldMappings" fm
LEFT JOIN "Connections" c ON c.id = fm."ConnectionId"
WHERE c.id IS NULL
GROUP BY fm."ConnectionId";
-- Expected: 2099, 3  ← filas huérfanas

-- 5. Campaigns referenciando Segments que no existen
SELECT c."Id", c."SegmentId" FROM "Campaigns" c
LEFT JOIN "Segments" s ON s."Id" = c."SegmentId"
WHERE s."Id" IS NULL;
-- Expected: empty (integridad OK)
```

### Checks de código (revisar antes de deploy)

```
[ ] backend/src/routes/campaigns.js — actualizar para usar CampaignChannels tabla en vez de Channels JSON
[ ] backend/src/routes/segments.js — actualizar referencias a Filters si se renombra a FilterDefinition
[ ] backend/src/routes/jobOffers.js — ya usa OfferId como PK; cambiar a Id después de recrear tabla
[ ] backend/src/db/db.js — puede simplificarse después de que todas las rutas usen Supabase nativo
```

---

## Riesgos identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| DROP JobOffers con datos nuevos si alguien insertó | Baja (0 rows confirmado) | Alto | Verificar COUNT=0 inmediatamente antes del DROP |
| `NOTIFY pgrst` no recarga cache en instancia Vercel | Media | Medio | Test manual post-deploy |
| Campaigns.Channels JSON queda inconsistente con CampaignChannels nuevo | Alta | Bajo | No borrar Campaigns.Channels hasta migrar código |
| FieldMappings.ConnectionId=2099 rompe FK si se añade constraint | Alta | Bajo | Limpiar las 3 filas antes de añadir FK formal |
| Segments con datos de usuarios que ya no existen | Baja | Bajo | Verificar CHECK 5 arriba |
| Connections.clientId sin FK a tabla Clients | Alta | Bajo | No añadir FK ahora; tabla Clients depreciada |
