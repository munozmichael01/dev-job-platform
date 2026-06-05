# Auditoria del Spike Gemini: ATS Candidates/Applications

## Resumen ejecutivo

El spike de Gemini debe mantenerse como referencia funcional, no como base lista para integrar.

Decision:

- No ejecutar la migracion SQL del spike.
- No integrar las rutas tal como estan.
- No integrar la pagina Kanban tal como esta.
- Si rescatar el concepto de `Candidate`, `Application` y pipeline Kanban.
- Si rescatar la intencion de usar Supabase nativo en rutas nuevas.

El problema principal no es la calidad visual ni la intencion del codigo. El problema es que el spike asume contratos de datos que no estan cerrados y mezcla decisiones de ATS antes de estabilizar el modulo actual de ofertas/distribucion.

## Archivos revisados desde la rama spike

- `backend/scripts/create-ats-tables.sql`
- `backend/src/routes/candidates.js`
- `backend/src/routes/applications.js`
- `frontend/app/candidatos/page.tsx`
- `frontend/lib/api.ts`

## Hallazgos criticos

### 1. Relacion incorrecta o no confirmada con JobOffers

El SQL del spike define:

```sql
"OfferId" INTEGER REFERENCES "JobOffers"("OfferId") ON DELETE CASCADE
```

Riesgo:

- El codigo operativo actual usa frecuentemente `JobOffers.Id` como identificador interno.
- `ExternalId` se usa como identificador del sistema externo.
- Hay esquemas historicos que mencionan `OfferId`, pero no deben imponerse sobre la realidad operativa actual sin validar la tabla real en Supabase.

Decision:

- La nueva entidad `Application` debe usar `JobOfferId` como FK al ID interno real de `JobOffers`.
- Si la tabla real usa `"Id"`, entonces `Applications.JobOfferId -> JobOffers.Id`.
- `ExternalId` no debe usarse como FK interna.
- No usar `OfferId` como nombre nuevo hasta cerrar el contrato.

### 2. RLS incompatible o incompleto

El SQL usa:

```sql
auth.uid()::text::bigint
```

Riesgo:

- La app actual usa JWT propio con `userId` numerico.
- El backend usa service role para queries de servidor.
- Supabase Auth no es la fuente actual de identidad.
- Las politicas RLS podrian no proteger nada relevante o bloquear flujos legitimos.
- `Interviews` ni siquiera tiene RLS habilitado en el script.

Decision:

- No introducir RLS hasta definir si la app migra a Supabase Auth o mantiene JWT propio.
- Mientras se use service role desde backend, la seguridad debe vivir en middleware + filtros obligatorios por usuario/organizacion.
- Si se activa RLS despues, debe tener una estrategia compatible con la auth real.

### 3. Duplicacion de CORS en rutas nuevas

`candidates.js` y `applications.js` repiten arrays locales de origins.

Riesgo:

- Ya hubo problemas de CORS en produccion.
- Las rutas nuevas no incluyen los dominios productivos.
- Se multiplica la probabilidad de divergencia.

Decision:

- Las rutas nuevas no deben configurar CORS manualmente.
- CORS debe centralizarse en middleware global.

### 4. Auth/middleware mezclado con service role

Las rutas nuevas crean su propio cliente:

```js
createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
```

Riesgo:

- Se duplica configuracion.
- Se salta cualquier helper compartido.
- Service role exige filtros de seguridad impecables en cada query.

Decision:

- Usar un cliente compartido desde la capa de DB existente o un helper dedicado.
- Mantener filtrado obligatorio por `UserId`/`OrganizationId` en cada query.
- No mezclar `onlyOwnData()` si no aporta una garantia clara y testeable.

### 5. Candidate demasiado plano para version final

`Candidates` guarda:

- skills como `TEXT`
- experience como `TEXT`
- education como `TEXT`
- resume URL simple

Esto esta bien para MVP, pero no para matching/IA robusta.

Decision:

- Para Fase 2 puede aceptarse un perfil minimo plano.
- Para agentes de matching, crear despues estructuras normalizadas o campos JSONB versionados.
- No bloquear Fase 0 por esto.

### 6. Application mezcla pipeline humano con scoring IA

`Applications` incluye `Status`, `MatchingScore`, `MatchingDetails`.

Riesgo:

- `MatchingScore` puede ser inventado o manual.
- No hay trazabilidad de agente, prompt, modelo ni explicacion versionada.

Decision:

- `Application.Status` pertenece al pipeline humano.
- Scoring IA debe relacionarse con `AgentRun`/`AgentRecommendation` o un objeto de evaluacion versionado.
- Si se deja `MatchingScore` en `Application`, debe ser cache/summary, no fuente de verdad.

### 7. Frontend Kanban depende de contratos inconsistentes

La pantalla usa:

```ts
interface Offer {
  id?: number;
  OfferId: number;
  Title: string;
  CompanyName?: string;
}
```

Pero `fetchOffers()` actual llama a `/job-offers` y la respuesta normalizada suele usar `id`, `title`, `company`.

Riesgo:

- Dropdown vacio o keys incorrectas.
- Asociacion de candidatos a oferta equivocada.
- Bugs silenciosos entre `id`, `OfferId`, `Title` y `title`.

Decision:

- No integrar el Kanban hasta definir un DTO unico de oferta para frontend.
- Rescatar el layout y la idea de pipeline, no la integracion actual.

### 8. Matching score ficticio

La pantalla crea applications con:

```ts
Math.floor(Math.random() * 40) + 50
```

Riesgo:

- Puede confundirse con IA real.
- Ensucia datos productivos.

Decision:

- Prohibido guardar scores ficticios en base de datos.
- Para demos, usar datos locales o marcarlo explicitamente como mock sin persistencia.

### 9. Scripts temporales y cache

El spike genero:

- `backend/scratch/`
- `backend/npm-cache/`
- scripts de migracion ad hoc

Decision:

- No commitear cache ni scratch.
- No ejecutar scripts de migracion del spike.
- Las migraciones futuras deben ser revisadas y versionadas.

## Que se rescata

### Backend

- La separacion conceptual entre candidates y applications.
- El uso de Supabase nativo como direccion correcta.
- Endpoints REST basicos como referencia de forma.

### Frontend

- La idea de una vista lista de candidatos.
- La idea de Kanban por oferta.
- El modal de candidato como prototipo visual.

### Producto

- Pipeline basico:
  - applied
  - screening
  - interviewing
  - offered
  - rejected

## Que no se rescata tal cual

- `create-ats-tables.sql`.
- FK `Applications.OfferId -> JobOffers.OfferId`.
- RLS con `auth.uid()::text::bigint`.
- CORS local por ruta.
- Matching score aleatorio.
- Tipos frontend de oferta basados en `OfferId` sin contrato.
- Registro de rutas en `backend/index.js` antes de estabilizar ofertas.

## Contrato recomendado para futura Fase 2

### Candidate

Campos minimos:

- `Id`
- `UserId` o `OrganizationId`
- `FirstName`
- `LastName`
- `Email`
- `Phone`
- `Location`
- `Source`
- `ResumeUrl`
- `ProfileSummary`
- `SkillsText`
- `CreatedAt`
- `UpdatedAt`

Notas:

- `Email` no debe ser unico globalmente sin decidir multi-tenant.
- Skills normalizadas pueden venir despues.

### Application

Campos minimos:

- `Id`
- `UserId` o `OrganizationId`
- `CandidateId`
- `JobOfferId`
- `Status`
- `Source`
- `AppliedAt`
- `CreatedAt`
- `UpdatedAt`

Notas:

- `UNIQUE(JobOfferId, CandidateId)` tiene sentido.
- `Status` debe ser enum controlado o check constraint.
- `MatchingScore` puede agregarse despues como summary cache, no como verdad primaria.

### AgentEvaluation futura

Campos sugeridos:

- `Id`
- `AgentRunId`
- `ApplicationId`
- `Score`
- `Recommendation`
- `Strengths`
- `Risks`
- `Gaps`
- `Explanation`
- `CreatedAt`

## Criterio para que Claude implemente despues

Antes de implementar Candidates/Applications:

1. Confirmar schema real de `JobOffers` en Supabase.
2. Definir si el propietario sera `UserId` o `OrganizationId`.
3. Definir nombres finales: preferencia `JobOfferId`, no `OfferId`.
4. Crear migracion nueva revisada, no usar la del spike.
5. Usar Supabase client compartido.
6. No duplicar CORS.
7. No registrar rutas en `backend/index.js` hasta que backend este estabilizado.
8. No persistir scores mock.

## Decision final

El spike Gemini queda aprobado como referencia de producto y UI, pero rechazado como implementacion directa.

Estado:

- `Candidate`: aprobado conceptualmente.
- `Application`: aprobado conceptualmente con cambio de FK/naming.
- `Interviews`: pospuesto.
- Kanban: aprobado como UX futura, no como integracion actual.
- Migracion SQL: rechazada y debe reescribirse.
