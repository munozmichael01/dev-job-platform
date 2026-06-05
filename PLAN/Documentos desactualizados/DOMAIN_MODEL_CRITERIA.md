# Modelo de Dominio y Criterio Tecnico Inicial

## Decision base

La plataforma no debe modelarse como un ATS completo desde el inicio. El dominio inicial debe mantener como nucleo la distribucion inteligente de ofertas y preparar extensiones hacia candidatos, matching y agentes.

## Modulos principales

### 1. Organizacion y usuarios

Entidades:

- `Organization`
- `User`
- `Role`

Criterio:

- Toda entidad operativa debe pertenecer a una organizacion o usuario propietario.
- Evitar mezclar identidad de usuario con empresa textual libre.
- Mantener compatibilidad con los IDs numericos actuales antes de migrar a otro esquema.

### 2. Ofertas

Entidades:

- `JobOffer`
- `JobOfferSource`
- `JobOfferVersion`

Criterio:

- `JobOffer` debe tener un identificador interno unico y estable.
- `ExternalId` debe representar el ID de sistemas externos, nunca la PK interna.
- Evitar mezclar `Id`, `OfferId` y `ExternalId` sin contrato claro.
- Para nuevas entidades, usar `JobOfferId` como nombre de FK hacia el identificador interno real de `JobOffers`.
- Antes de crear tablas nuevas, confirmar si la tabla real en Supabase usa `"Id"` o `"OfferId"` como PK operativa.
- Si la tabla real usa `"Id"`, entonces `Application.JobOfferId` debe referenciar `JobOffers.Id`.
- Si la tabla real usa `"OfferId"` como PK, entonces `Application.JobOfferId` debe referenciar `JobOffers.OfferId`; aun asi, el nombre de la FK nueva debe ser `JobOfferId` para evitar confundirlo con IDs externos.
- No usar `ExternalId` como FK entre tablas internas.
- Las versiones permiten que agentes mejoren textos sin destruir la oferta original.

Decision tras auditoria 2026-06-02:

- La tabla real `JobOffers` en Supabase esta vacia.
- La PK observada es `OfferId`.
- `JobOffers.UserId` aparece como UUID, mientras la auth actual usa `Users.Id` BIGINT en el JWT.
- Antes de importar ofertas reales, hay que corregir o confirmar este contrato de ownership.
- Como no hay ofertas productivas que preservar, es preferible arreglar el schema ahora antes que adaptar nuevos modulos a una tabla inconsistente.

### 3. Distribucion

Entidades:

- `Campaign`
- `Segment`
- `DistributionChannel`
- `DistributionRun`
- `ChannelCredential`
- `PerformanceMetric`

Criterio:

- Este es el primer modulo comercial.
- Debe soportar el flujo: importar oferta -> segmentar -> crear campana -> distribuir -> medir -> recomendar.
- El agente distribuidor debe operar sobre estas entidades, no sobre datos sueltos.

### 4. Agentes

Entidades:

- `Agent`
- `AgentRun`
- `AgentRecommendation`
- `AgentDecision`

Criterio:

- Toda ejecucion de agente debe quedar persistida.
- Una recomendacion de IA no debe reemplazar automaticamente la decision humana.
- Cada decision debe guardar input, output, version del prompt/modelo y estado de aceptacion.

Primeros agentes:

- `JobDescriptionAgent`
- `DistributionAgent`
- `PerformanceAgent`

Agentes posteriores:

- `MatchingAgent`
- `ScreeningAgent`
- `SchedulingAgent`
- `RecruiterReportAgent`

### 5. Candidatos

Entidades:

- `Candidate`
- `Application`
- `CandidateProfile`
- `CandidateDocument`

Criterio:

- `Candidate` representa a la persona.
- `Application` representa la postulacion de esa persona a una oferta concreta.
- Un candidato puede aplicar a varias ofertas.
- La relacion debe apuntar al ID interno de `JobOffer`, no al `ExternalId`.
- Matching score, screening status y notas deben vivir en `Application` o entidades asociadas, no en `Candidate` global.

### 6. Entrevistas e informes

Entidades:

- `Interview`
- `AvailabilitySlot`
- `RecruiterReport`
- `CandidateEvaluation`

Criterio:

- No crear esta capa hasta validar Candidates/Applications.
- La integracion de calendario debe venir despues del modelo de postulaciones.

## Auditoria inicial del spike Gemini

### Mantener como referencia

- Idea de `Candidate`.
- Idea de `Application`.
- Kanban como concepto funcional.
- Uso de Supabase nativo en rutas nuevas.

### Revisar antes de integrar

- Relacion con `JobOffers`: validar si la PK real es `Id`, no `OfferId`.
- RLS: validar compatibilidad con JWT propio y service role.
- CORS: eliminar configuraciones duplicadas.
- Auth: usar middlewares compartidos.
- Frontend: alinear tipos de oferta con `frontend/lib/api.ts`.
- Scripts: no commitear caches, scratch ni migraciones sin revision.

### No ejecutar todavia

- `backend/scripts/create-ats-tables.sql`
- `backend/scripts/run-ats-migration.js`
- `backend/scripts/run-ats-migration-pg.js`

## Criterio para aprobar una nueva tabla

Antes de crear una tabla nueva, debe quedar definido:

- propietario de datos
- relacion con `Organization` o `User`
- PK interna
- IDs externos
- permisos
- si participa en agentes
- si se necesita ahora o en una fase posterior

## Fases recomendadas

### Fase 0: estabilizacion

- Auditar adapter legacy.
- Reescribir rutas criticas en Postgres/Supabase nativo.
- Corregir errores 500 y empty states.
- Consolidar CORS.
- Definir contrato de dominio.

### Fase 1: agente comercial inicial

- Mejorar/redactar ofertas.
- Recomendar canales.
- Guardar recomendaciones y decisiones humanas.
- Medir performance por canal/campana.

### Fase 2: candidatos y matching

- Crear `Candidate` y `Application`.
- Normalizar candidatos entrantes.
- Matching explicable.
- Kanban revisado.

### Fase 3: entrevistas e informes

- Scheduling.
- Evaluacion.
- Shortlist.
- Informe final al reclutador.
