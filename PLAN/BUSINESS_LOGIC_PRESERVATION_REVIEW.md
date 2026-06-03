# Business Logic Preservation Review
## Qué conservar, qué rediseñar, qué archivar

**Fecha:** 2026-06-03  
**Autores:** Codex (criterio) + Claude Code (análisis técnico)  
**Status:** APROBADO para guiar SQL propuesto — sin ejecutar aún

---

## Marco de análisis

Cada entidad se evalúa en tres dimensiones independientes:

| Dimensión | Pregunta |
|---|---|
| **Concepto de negocio** | ¿El concepto tiene valor en el nuevo producto? |
| **Tabla / schema actual** | ¿La implementación actual sirve o hay que rediseñarla? |
| **Registros existentes** | ¿Los datos actuales son útiles, archivables o descartables? |

Un concepto puede conservarse aunque el schema y los registros no.

---

## Tabla de decisiones

| Tabla actual | Concepto de negocio | ¿Concepto se conserva? | ¿Tabla actual se conserva? | ¿Registros se conservan? | Acción recomendada | Riesgo |
|---|---|---|---|---|---|---|
| `Users` | Identidad y auth de usuarios humanos | ✅ Sí | ✅ Sí, sin cambios destructivos | ✅ Sí, todos | ALTER no-destructivo: añadir Phone, PasswordHash si faltan, OrganizationId nullable | Auth JWT depende de Id BIGINT — no cambiar tipo ni PK |
| `Connections` | Fuente de datos externa (feed XML, CSV, API) | ✅ Sí | ✅ Sí, como legacy estable | ⚠️ Parcial — 89 filas, auditar cuáles tienen URLs activas | Mantener tabla. Añadir UserId FK formal. Crear SourceConnections como alias/evolución futura | clientId=1 hardcodeado en muchas; Connections.id es snake_case vs PascalCase del resto |
| `FieldMappings` | Mapping versionado de fuente a modelo canónico | ✅ Sí | ⚠️ Sí, pero con columnas nuevas | ❌ No — 3 filas apuntan a ConnectionId=2099 inexistente (huérfanas) | ALTER TABLE para añadir SourcePath, Version, Required, DefaultValue. DELETE filas huérfanas | Riesgo bajo: solo 3 filas de testing |
| `JobOffers` | Oferta de empleo canónica interna | ✅ Sí | ❌ No — schema incompatible | ❌ No — 0 filas | DROP + CREATE con PK=Id BIGINT, UserId BIGINT FK, sin columnas legacy SQL Server | DROP seguro confirmado (COUNT=0). Recrear sin UUID mismatch |
| `Segments` | Segmentación dinámica/estática de ofertas | ✅ Sí | ❌ No — schema desfasado | ⚠️ Archivar — 17 filas pero OfferCount=0 (sin ofertas reales) | BACKUP en Segments_bak → DROP → CREATE limpio. Filtros pueden re-crearse cuando haya ofertas | Pérdida de contexto si alguien creó segmentos con intención; archivarlos mitiga esto |
| `Campaigns` | Agrupación de distribución de ofertas por segmento/canal | ✅ Sí | ❌ No — Channels es JSON crudo, sin FK formales | ⚠️ Archivar — 15 filas pero sin ofertas reales asociadas | BACKUP en Campaigns_bak → DROP → CREATE limpio con FK a Segments y CampaignChannels | Cascada sobre CampaignChannels (0 filas) — sin riesgo de pérdida real |
| `CampaignChannels` | Relación formal campaña ↔ canal | ✅ Sí | ❌ No — sin FK a DistributionChannels | ❌ No — 0 filas | DROP → CREATE con FK (CampaignId, ChannelId) correctas | Sin datos: riesgo cero |
| `UserChannelCredentials` | Credenciales por usuario/canal | ✅ Sí | ❌ No — sin FK a canales, naming inconsistente | ❌ No — 0 filas | DROP → CREATE como ChannelCredentials con FK a DistributionChannels | Sin datos: riesgo cero |
| `Clients` | Entidad de cliente/tenant (legacy) | ⚠️ Parcial — absorbe en Organizations/Users | ⚠️ Mantener temporalmente | ⚠️ Auditar | No tocar por ahora. Future: migrar a OrganizationId en Users | Connections.clientId referencia esta tabla; romper requiere actualizar 89 filas |
| `Mappings` | Mapeado de campos (schema antiguo) | ❌ Reemplazado por FieldMappings | ❌ No | ❌ No | Tabla vacía — ignorar por ahora, DROP en limpieza futura | Sin datos: riesgo cero |
| `Metrics` | Métricas de performance | ✅ Sí | ❌ No — schema antiguo | ❌ No — 0 filas | Crear PerformanceMetrics nuevo en Fase 6 del roadmap | Sin datos: riesgo cero |
| `Organizations` | Tenant/empresa propietaria (futuro multi-tenant) | ✅ Sí (futuro) | N/A — no existe aún | N/A | Crear nullable con OrganizationId en Users. No bloquear auth actual | No introducir como required hasta que multi-tenant esté activo |
| `RawJobRecords` | Registro crudo antes de transformar | ✅ Sí | N/A — no existe aún | N/A | Crear nueva en Fase 3 | Requiere JobOffers nuevo para FK |
| `DistributionChannels` | Catálogo de canales externos | ✅ Sí | N/A — no existe aún | N/A | Crear nueva + seed de 7 canales conocidos | Sin canales en catálogo, CampaignChannels no tiene sentido |
| `DistributionRuns` | Ejecución de distribución | ✅ Sí | N/A — no existe aún | N/A | Crear nueva en Fase 6 | Depende de CampaignChannels y JobOffers |
| `DistributionItems` | Resultado por oferta/canal en cada run | ✅ Sí | N/A — no existe aún | N/A | Crear nueva en Fase 6 | Depende de DistributionRuns y JobOffers |
| `AgentRuns` | Trazabilidad de ejecuciones IA | ✅ Sí | N/A — no existe aún | N/A | Crear nueva en Fase 9 | No bloquea MVP; crear ahora para no acumular deuda |
| `AgentRecommendations` | Recomendaciones IA pendientes de revisión humana | ✅ Sí | N/A — no existe aún | N/A | Crear nueva en Fase 9 | Requiere AgentRuns |

---

## Análisis en detalle de las decisiones no obvias

### Connections — ¿por qué conservar?

La tabla tiene 89 filas con URLs reales. El concepto (`SourceConnection` = fuente de datos externa) es exactamente lo que el blueprint llama `SourceConnections`. El schema actual tiene problemas menores (naming mixto, clientId hardcodeado), pero los datos son útiles.

**Decisión:** mantener la tabla `Connections` como implementación actual del concepto `SourceConnection`. Añadir columnas sin romper. En el futuro, cuando se active multi-tenant, migrar `clientId` → `OrganizationId`.

### Segments — ¿por qué archivar y recrear?

Los 17 segmentos tienen `OfferCount=0`. Sin ofertas reales, un segmento no segmenta nada. El schema actual tiene `Filters` como JSON con keys inconsistentes (`jobTitles`, `locations`, `sectors`, `experienceLevels`, `contractTypes`) en vez de `FilterDefinition` con el modelo canónico. El concepto (`Segment` = selección dinámica/estática de ofertas) sí tiene valor.

**Decisión:** archivar los 17 segmentos en `Segments_bak` (preservar contexto), DROP y recrear `Segments` con schema limpio. Los filtros se recrearán cuando haya ofertas reales con las que validarlos.

### Campaigns — ¿por qué archivar y recrear?

Las 15 campañas usan `Channels` como JSON string crudo (`["jooble"]`), no como FK a una tabla de canales. Sin ofertas reales, estas campañas tampoco distribuyeron nada efectivamente. El concepto (`Campaign` = agrupación de distribución segmento → canal) sí tiene valor.

**Decisión:** archivar las 15 campañas en `Campaigns_bak`, DROP y recrear `Campaigns` con `CampaignChannels` como tabla de relación formal. El esquema de presupuesto, fechas y estado se conserva y mejora.

### FieldMappings — ¿por qué limpiar datos pero conservar tabla?

Las 3 filas apuntan a `ConnectionId=2099` que no existe en `Connections`. Son claramente datos de testing o desarrollo. Pero el schema de la tabla es reutilizable (SourceField, TargetField, TransformationType). La tabla necesita columnas adicionales (`SourcePath`, `Version`, `Required`, `DefaultValue`) pero no un DROP completo.

**Decisión:** DELETE las 3 filas huérfanas, ALTER TABLE para añadir columnas del blueprint. Los mappings reales se crearán cuando se conecte el primer feed XML.

---

## Resumen ejecutivo

```
CONSERVAR intacto:     Users (15 filas, auth depende)
                       Connections (89 filas, URLs reales)

LIMPIAR datos,         FieldMappings (3 filas huérfanas → DELETE)
conservar schema:      (+ ALTER para columnas nuevas)

ARCHIVAR y recrear:    Segments (17 filas → Segments_bak → DROP → CREATE)
                       Campaigns (15 filas → Campaigns_bak → DROP → CASCADE)

DROP seguro            JobOffers (0 filas, schema incompatible → CREATE limpio)
y recrear:             CampaignChannels (0 filas → CREATE con FK)
                       UserChannelCredentials (0 filas → ChannelCredentials)

CREAR nuevo:           DistributionChannels (catálogo + seed 7 canales)
                       RawJobRecords
                       DistributionRuns
                       DistributionItems
                       ChannelCredentials
                       AgentRuns
                       AgentRecommendations

DIFERIR:               Organizations (preparar nullable, activar con multi-tenant)
                       Candidates/Applications/Interviews (Fase 8+ del roadmap)
```

---

## Preguntas abiertas que el usuario debe responder antes de ejecutar

1. **¿Los 15 Campaigns y 17 Segments tienen valor como referencia?**  
   Si sí → archivar en `_bak`. Si no → DROP directo sin backup.

2. **¿Las 89 Connections tienen URLs activas o son datos de desarrollo?**  
   Auditar antes de migrar: `SELECT id, name, url, status FROM "Connections" ORDER BY status`.

3. **¿`Users` tiene Phone y PasswordHash en el schema live o solo en el SQL script?**  
   Ejecutar en SQL Editor: `SELECT column_name FROM information_schema.columns WHERE table_name = 'Users' ORDER BY ordinal_position;`

4. **¿Se quiere añadir `OrganizationId` a `Users` ya en esta migración, o diferirlo?**  
   Recomendación: añadir como nullable ahora, sin FK constraint, para no bloquear la migración.
