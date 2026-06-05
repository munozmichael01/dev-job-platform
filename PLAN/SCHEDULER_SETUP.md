# Scheduler Setup — Import automático de ofertas

## Arquitectura

```
cron-job.org (cada 5 min)
    │
    └─► GET /api/scheduled/run-scheduled
              │
              ├─ Conexiones con pendingRecords > 0   ← prioridad
              │       └─ procesa batches (50 ofertas cada uno)
              │           hasta agotar budget de 42s
              │
              └─ Conexiones vencidas por frecuencia
                      └─ buffer XML → primer batch
                          (continuará en la próxima ejecución)
              │
              └─► devuelve { nextRunNeeded: true/false }
```

El navegador del usuario **no procesa batches**. Solo observa el estado
via `GET /api/connections/:id/import/status`. Si el usuario cierra la
pestaña, el import continúa en la próxima ejecución del scheduler.

---

## Configurar cron-job.org

### 1. Crear cuenta

Ir a [cron-job.org](https://cron-job.org) y crear una cuenta gratuita.

### 2. Crear nuevo cron job

- **Title:** TalentOS Import Scheduler
- **URL:** `https://dev-job-platform-backend.vercel.app/api/scheduled/run-scheduled`
- **Execution schedule:** Every 5 minutes
  - O cada 2 minutos durante imports iniciales grandes

### 3. Configurar header de autorización

En la sección **"Request headers"** añadir:

| Header name     | Header value            |
|-----------------|-------------------------|
| `Authorization` | `Bearer <TU_CRON_SECRET>` |

⚠️ El `CRON_SECRET` es el valor configurado en Vercel Dashboard → Backend
project → Environment Variables → `CRON_SECRET`. Nunca lo compartas en
logs, commits ni documentación.

### 4. Configurar método HTTP

- **Request method:** `GET`

### 5. Guardar y activar

Vercel Cron ya está configurado como fallback diario a las 6am UTC.
cron-job.org actúa como el scheduler primario para drenar imports grandes.

---

## Respuesta del endpoint

```json
{
  "success": true,
  "durationMs": 38420,
  "processed": 100,
  "failed": 0,
  "completed": [2102],
  "partial": [{ "id": 2100, "remaining": 210 }],
  "skipped": [],
  "nextRunNeeded": true,
  "message": "1 conexiones con lotes pendientes para la próxima ejecución"
}
```

| Campo | Significado |
|---|---|
| `completed` | Conexiones que terminaron el import en esta ejecución |
| `partial` | Conexiones con trabajo pendiente → la próxima ejecución continúa |
| `skipped` | Conexiones que no entraron en el budget de tiempo |
| `nextRunNeeded` | `true` si hay trabajo pendiente para la próxima ejecución |

---

## Comportamiento del sistema

### Al crear una nueva conexión XML

1. El usuario visita `/conexiones`
2. La página detecta `lastSync=null` y encola la conexión automáticamente
3. El frontend llama `POST /api/scheduled/start/:id` **una sola vez**
4. El frontend hace polling de `/import/status` cada 5s para mostrar progreso
5. El scheduler externo (cron-job.org) toma el relevo y drena los lotes restantes

### Sincronización diaria

El scheduler comprueba cada 5 minutos si alguna conexión tiene:
- `pendingRecords > 0` → continúa el import
- `lastSync` más antiguo que su `frequency` → inicia nueva sincronización

### Si una oferta desaparece del feed

Según la regla de reconciliación:
- `ExpirationDate` en el futuro (o ausente) → `Status = 'paused'` en JobOfferSources
- `ExpirationDate` pasada → `Status = 'archived'` en JobOfferSources
- El `JobOffer` canónico solo se pausa/archiva si **todas** sus fuentes están inactivas

---

## Frecuencias recomendadas

| Situación | Frecuencia |
|---|---|
| Import inicial de feed grande (3000+ ofertas) | cada 2 min |
| Operación normal con varios feeds | cada 5 min |
| Mantenimiento / sin imports activos | Vercel Cron diario es suficiente |

---

## Variables de entorno necesarias (backend Vercel)

| Variable | Descripción |
|---|---|
| `CRON_SECRET` | Secret para autorizar llamadas al scheduler. Configurar en Vercel Dashboard → backend project → Environment Variables |

---

## Verificar que el scheduler funciona

```bash
# Sin Authorization → debe devolver 401
curl -s -o /dev/null -w "%{http_code}" \
  https://dev-job-platform-backend.vercel.app/api/scheduled/run-scheduled

# Con Authorization correcta → debe devolver 200
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer <TU_CRON_SECRET>" \
  https://dev-job-platform-backend.vercel.app/api/scheduled/run-scheduled
```
