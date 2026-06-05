# Documento tecnico — Importacion de ofertas

Fecha de cierre: 2026-06-05
Estado: MVP operativo con XML por URL y scheduler externo

## Resumen tecnico

El sistema de importacion usa Supabase PostgreSQL como fuente de verdad y procesa ofertas externas mediante una cola persistida en base de datos.

El navegador no procesa batches. El frontend inicia o monitorea importaciones; el backend y el scheduler procesan el trabajo.

## Componentes principales

| Componente | Rol |
|---|---|
| `Connections` | Configuracion de fuentes externas por usuario. |
| `RawJobRecords` | Cola persistida y payload bruto por conexion. |
| `JobOffers` | Oferta canonica unica. |
| `JobOfferSources` | Vinculo entre oferta canonica y conexion/fuente externa. |
| `XMLImporter` | Parser, transformador, deduplicador y reconciliador XML. |
| `importScheduler` | Procesador server-driven por lotes. |
| `cron-job.org` | Scheduler externo frecuente para drenar backlog. |
| Vercel Cron | Fallback diario. |

## Archivos relevantes

| Archivo | Uso |
|---|---|
| `backend/src/processors/xmlImporter.js` | Logica de import XML, transformacion, upsert y reconciliacion. |
| `backend/src/routes/importScheduler.js` | Endpoints de scheduler y start manual. |
| `backend/src/routes/connections.js` | Estado de conexiones, upload/import legacy compatible y status. |
| `frontend/app/conexiones/page.tsx` | UI de conexiones, polling y estados visuales. |
| `frontend/lib/api.ts` | Cliente API autenticado. |
| `backend/scripts/add-job-offer-sources.sql` | Migracion incremental de deduplicacion canonica. |
| `PLAN/SCHEDULER_SETUP.md` | Configuracion operativa de cron-job.org. |

## Modelo de datos

### `RawJobRecords`

Guarda cada registro crudo recibido desde una conexion.

Campos clave:

- `UserId`
- `ConnectionId`
- `ExternalId`
- `RawFormat`
- `RawPayload`
- `PayloadHash`
- `ProcessingStatus`
- `ProcessingError`
- `JobOfferId`

Estados relevantes:

| Estado | Significado |
|---|---|
| `pending` | Pendiente de transformar. |
| `processed` | Transformado y vinculado a una oferta. |
| `failed` | Registro invalido o error no bloqueante. |

`failed` no mantiene viva la cola. `hasMore` depende solo de registros `pending`.

### `JobOffers`

Representa la oferta canonica interna.

Constraint canonico:

```sql
UNIQUE ("UserId", "SourceSystem", "ExternalId")
```

Esto impide duplicados canonicos aunque la misma oferta llegue por varias conexiones.

### `JobOfferSources`

Registra cada fuente/conexion donde aparecio una oferta.

Constraint por fuente:

```sql
UNIQUE ("UserId", "ConnectionId", "ExternalId")
```

Permite que una oferta canonica tenga multiples fuentes sin duplicarse.

## Identidad y deduplicacion

La identidad se resuelve asi:

```text
SourceSystem + ExternalId + UserId = JobOffer canonica
ConnectionId + ExternalId + UserId = fuente de esa oferta
```

Ejemplo:

```text
Feed A: ExternalId 327903, SourceSystem turijobs
Feed B: ExternalId 327903, SourceSystem turijobs

JobOffers: una fila
JobOfferSources: dos filas
```

`JobOffers.ConnectionId` se mantiene como campo informativo/compatibilidad temporal, pero la relacion funcional por fuente debe consultarse en `JobOfferSources`.

## Flujo tecnico de import XML

### Fase 1 — Buffer

Endpoint o scheduler descarga el XML y guarda cada oferta como `RawJobRecords`.

```text
XML feed
  -> parse XML
  -> extract offer list
  -> transform minimo para ExternalId/Title
  -> upsert RawJobRecords(ConnectionId, ExternalId)
  -> ProcessingStatus = pending
```

### Fase 2 — Process batch

El scheduler toma un lote de registros `pending`.

```text
RawJobRecords pending
  -> transformOffer()
  -> upsert JobOffers(UserId, SourceSystem, ExternalId)
  -> upsert JobOfferSources(UserId, ConnectionId, ExternalId)
  -> RawJobRecords.JobOfferId = JobOffers.Id
  -> ProcessingStatus = processed
```

Si un registro falla:

```text
ProcessingStatus = failed
ProcessingError = mensaje
```

El batch continua con los siguientes registros.

## Transformacion y campos

La transformacion actual soporta autodeteccion para feeds Turijobs/Bebee.

Ejemplos del mapping automatico:

| XML | Canonico |
|---|---|
| `id` | `ExternalId` |
| `url` | `ExternalUrl` |
| `url_apply` | `ApplicationUrl` |
| `title` | `Title` |
| `content` | `DescriptionHtml` |
| `company` | `CompanyName` |
| `companyid` | `CompanyExternalId` |
| `city` | `City` |
| `region` | `Region` |
| `country` | `Country` |
| `jobtype` | `JobType` |
| `contracttype` | `ContractType` |
| `workdaytype` | `WorkdayType` |
| `publication` | `PublicationDate` |
| `expiration` | `ExpirationDate` |

Los strings se normalizan con helpers defensivos para evitar errores por longitudes excesivas.

## Campos minimos recomendados

Para que una oferta sea publicable, el modelo funcional requiere:

- `ExternalId`
- `Title`
- `CompanyName`
- `PublicationDate`
- `ExpirationDate`
- Ubicacion suficiente, idealmente `Country` + `City`
- `ApplicationUrl` o `ExternalUrl`

El import actual puede aceptar algunos registros incompletos, pero la validacion estricta de publicabilidad queda para la fase de mapping/quality gate.

## Reconciliacion

La reconciliacion ocurre cuando una conexion termina de procesar todos sus registros pendientes.

Reglas:

1. Se toman todos los `ExternalId` procesados en la conexion actual.
2. Se comparan contra `JobOfferSources` activas de esa conexion.
3. Si una fuente desaparecio:
   - si la oferta no vencio, `JobOfferSources.StatusInSource = 'paused'`.
   - si vencio, `JobOfferSources.StatusInSource = 'archived'`.
4. La `JobOffer` canonica solo cambia de estado si no queda ninguna fuente activa para esa oferta.

Esto evita pausar una oferta canonica que aun llega por otra conexion.

## Scheduler

### Endpoint principal

```text
GET /api/scheduled/run-scheduled
Authorization: Bearer <CRON_SECRET>
```

Tambien existe `POST /api/scheduled/run-scheduled` para pruebas manuales si se mantiene habilitado.

### Endpoint de inicio manual

```text
POST /api/scheduled/start/:connectionId
```

Usado por el frontend cuando el usuario pulsa `Sync`. Debe iniciar o preparar el trabajo y dejarlo persistido, no depender de llamadas repetidas del navegador.

### Endpoint de estado

```text
GET /api/connections/:id/import/status
```

Devuelve:

- `pendingRecords`
- `failedRecords`
- `processedRecords`
- `importedOffers`
- `hasMore`
- `connectionStatus`

`hasMore = pendingRecords > 0`.

## Time budget y batches

Configuracion actual:

- `BATCH_SIZE = 50`
- `SAFE_BUDGET_MS = 42000`

La reduccion a 50 evita timeouts en Vercel Serverless. Los imports grandes se drenan en varias ejecuciones del scheduler externo.

## Scheduler externo

Se usa `cron-job.org` cada 5 minutos.

Motivo:

- Vercel Cron en plan Hobby es suficiente como fallback diario, pero no para drenar rapidamente imports grandes.
- `cron-job.org` ejecuta el scheduler cada pocos minutos.
- El backend es idempotente y retoma desde `RawJobRecords`.

Configuracion completa en `PLAN/SCHEDULER_SETUP.md`.

## Seguridad

- `CRON_SECRET` se configura solo en el proyecto backend de Vercel.
- No se debe guardar el valor en repo, logs, prompts ni documentacion.
- El endpoint programado valida `Authorization: Bearer <CRON_SECRET>`.
- Sin header correcto devuelve `401`.

## Frontend

La UI no procesa batches.

Responsabilidades del frontend:

- Iniciar import con una llamada puntual.
- Hacer polling de estado.
- Mostrar estados claros.
- Permitir que el usuario salga de la pagina.

No debe ejecutar loops de procesamiento mientras `hasMore=true`.

## Estado de mapeo

El mapeo universal NO queda cerrado en esta fase.

Estado actual:

- `XMLImporter` usa autodeteccion Turijobs/Bebee.
- `loadFieldMappings(connectionId)` permite usar mappings existentes desde `FieldMappings`.
- La pantalla de mapeo existe, pero el flujo universal y validado no esta cerrado.

Pendiente tecnico:

- Deteccion generica de campos por tipo de fuente.
- Sugerencia automatica de mapping.
- Confirmacion/edicion por usuario.
- Versionado de mapping por conexion.
- Validacion de campos obligatorios antes de importar.
- Reproceso de `RawJobRecords` al cambiar mapping.
- Soporte equivalente para CSV, Excel y API.

## Riesgos y siguientes mejoras

| Riesgo | Mitigacion actual | Mejora futura |
|---|---|---|
| Dos procesos toman el mismo pending a la vez | Upsert canonico evita duplicados importantes | Claim atomico `pending -> processing` con lock por lote |
| Feeds grandes tardan varios ciclos | cron-job.org cada 5 min | Worker dedicado o queue real |
| Campos incompletos | Warnings y failed no bloqueantes | Quality gate antes de publicabilidad |
| Mapping de fuentes desconocidas | Autodeteccion limitada | Fase de mapping universal |

## Criterio tecnico de cierre

La fase queda cerrada si:

- `JobOffers` no tiene duplicados canonicos.
- `JobOfferSources` registra las fuentes por conexion.
- `RawJobRecords` drena pendientes por scheduler.
- El frontend no procesa batches.
- El usuario puede salir de la pagina sin detener el sistema.
- La documentacion vigente refleja esta realidad.
