## V0 Frontend Snapshot — Job Platform

Este documento describe el estado actual del frontend (sin peticiones de acción).

### Resumen
- Framework: Next.js 15 (App Router), React 19, TypeScript 5.3.
- UI: Tailwind 3.4, shadcn/ui + Radix, `next-themes`.
- Navegación: Sidebar persistente (`AppSidebar`) y layout global con `ThemeProvider` y `Toaster`.
- Datos: llamadas `fetch` directas y helpers en `frontend/lib/`. Existen dos capas: `api.ts` (usa `NEXT_PUBLIC_API_URL`) y `api-temp.ts` (base `http://localhost:3002`).
- Paginación: keyset (cursor) con hook `use-keyset-pagination` y adaptador tolerante `normalizeKeyset`.

### Scripts y configuración
- Scripts (`frontend/package.json`):
  - dev: `next dev -p 3006`
  - build: `next build`
  - start: `next start -p 3001`
- Next config: lint y errores de TS ignorados durante build.
- Tailwind: `tailwindcss-animate` habilitado.
- TS config: `strict: true`, `moduleResolution: bundler`, paths `@/*`.

### Dependencias principales
- next ^15.0.0, react ^19.0.0, react-dom ^19.0.0
- tailwindcss ^3.4.1, tailwind-merge ^2.2.1
- shadcn/ui (componentes en `components/ui`), Radix UI, lucide-react
- react-hook-form, zod (no se observan formularios complejos en producción)

### Layout y shell
- `frontend/app/layout.tsx`:
  - `ThemeProvider` (dark/light), `SidebarProvider` y `AppSidebar`.
  - `<main>` con `children` y `Toaster` global.

### Mapa de rutas (App Router)
- `/` (`app/page.tsx`): Dashboard con métricas simuladas y accesos a secciones.
- `/ofertas` (`app/ofertas/page.tsx`):
  - Listado con filtros (búsqueda con debounce ≥3 chars), estado, ubicación, sector, ID externo.
  - Paginación por keyset con `use-keyset-pagination`.
  - Estadísticas de resultados mostradas; loader y manejo de error con `ErrorMessage`.
- `/conexiones` (`app/conexiones/page.tsx`):
  - Gestión de conexiones: listado, creación (XML/API/Manual), sincronización e importación, subida de archivo para manual.
  - Métricas agregadas (activas, ofertas importadas, errores).
- `/conexiones/[id]/mapeo` (`app/conexiones/[id]/mapeo/page.tsx`):
  - Mapeo de campos de una conexión específica; vista previa, validación de requeridos y transformaciones simples (uppercase/lowercase/capitalize/trim).
- `/campanas` y `/campanas/nueva`:
  - Listado y creación de campañas (datos simulados).
- `/segmentos` y `/segmentos/nuevo`:
  - Gestión/creación de segmentos (datos simulados).
- `/metricas`: Panel con métricas agregadas (datos simulados).
- `/admin`: Panel de administración (datos simulados).
- `/test-api`: Verifica `NEXT_PUBLIC_API_URL` consultando `/api/connections`.

### Capa de datos (según código)
- `frontend/lib/api.ts` (usa `NEXT_PUBLIC_API_URL`, default `http://localhost:3001`):
  - `GET /api/connections`
  - `POST /api/connections`
  - `POST /api/connections/:id/import`
- `frontend/lib/api-temp.ts` (base fija `http://localhost:3002`):
  - Conexiones:
    - `GET /api/connections`
    - `POST /api/connections`
    - `POST /api/connections/:id/import`
    - `POST /api/connections/:id/upload` (FormData)
  - Ofertas:
    - `GET /job-offers` con query sargable y keyset (`limit`, `lastCreatedAt`, `lastId`, filtros `q|status|location|sector|externalId`, `mode`)
    - `GET /job-offers/locations`
    - `GET /job-offers/sectors`
    - `GET /job-offers/external-ids`

### Paginación y normalización
- `hooks/use-keyset-pagination.ts`:
  - Estado defensivo, retry con backoff, historial de cursores para “Anterior”.
  - URL construida con `buildKeysetUrl`; normalización con `normalizeKeyset`.
- `lib/api/normalizeKeyset.ts`:
  - Acepta respuestas `{items|data}`, `{hasMore|pagination.hasMore}` y `{next|pagination}`.
  - `total` desde `{total|pagination.total|count|stats.total|meta.total}` o derivado.
  - `dedupeById` tolerante `id|Id`.
  - `buildKeysetUrl` añade `lastCreatedAt` y `lastId` si existen y son válidos.

### Contratos de datos observados en UI
- Ofertas (consumo en tabla/filtros):
  - `id|Id`, `ExternalId`, `title`, `company`, `location`, `sector`, `salary`, `status` (active|pending|paused|archived), `publishDate|CreatedAt`.
- Listas de opciones:
  - `GET /job-offers/locations|sectors|external-ids` espera `{ success, data: string[] }`.
- Conexiones (listado y métricas):
  - Campos manejados con alias: `name|Name`, `type|Type`, `url|Url|Endpoint`, `frequency|Frequency`, `status|Status`, `lastSync|LastSync`, `importedOffers|ImportedOffers`, `errorCount|ErrorCount`.
- Mapeo de conexión:
  - `GET /api/connections/:id` ⇒ conexión
  - `GET /api/connections/:id/fields` ⇒ `{ success: boolean, fields: Array<{ name,type,sample,required,description }> }`
  - `GET /api/connections/:id/mapping` ⇒ `FieldMapping[]`
  - `POST /api/connections/:id/mappings` ⇒ guarda `FieldMapping[]`
  - `POST /api/connections/:id/test-mapping`
  - `DELETE /api/connections/:id`

### Componentes y hooks relevantes
- Sidebar: `components/app-sidebar.tsx` (links a todas las rutas).
- UI base shadcn: tablas, selects, popovers, toasts, dialogs en `components/ui/*`.
- Toasts: `hooks/use-toast.ts` (límite 1, tiempo de vida extendido para debug).
- Select buscable: `components/ui/searchable-select.tsx`.
- Scroll infinito utilitario (no activo en ofertas): `hooks/use-infinite-scroll.ts`.

### Observaciones objetivas
- Existen dos capas de API en paralelo:
  - `api.ts` (env, default 3001) y `api-temp.ts` (hardcode 3002).
- En `/ofertas` el `baseUrl` del hook está hardcodeado a `http://localhost:3002/job-offers`.
- `/test-api` consulta `NEXT_PUBLIC_API_URL` (por defecto 3001).
- En la página de mapeo, el tipo de `params` está declarado como `Promise<{ id: string }>` y se usa `React.use(params)` en un componente cliente.
- Hay logging de debug exhaustivo (con emojis) en hooks y páginas.
- `next.config.mjs` ignora errores de ESLint y TypeScript durante build.
- Varias secciones (campañas, segmentos, métricas, admin) utilizan datos simulados en cliente.
