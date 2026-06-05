# Estrategia de Ingesta y Estandarizacion de Ofertas

## Decision principal

No debemos migrar datos antiguos solo por migrarlos. Si `JobOffers` esta vacia en Supabase y los datos anteriores ya no son relevantes, lo correcto es construir un flujo nuevo de ingesta estandarizada.

La plataforma no debe depender de un modelo Turijobs como modelo universal. Turijobs debe ser tratado como un conector/fuente mas.

## Principio de arquitectura

Separar cuatro conceptos:

1. Datos originales recibidos del cliente.
2. Mapping desde la fuente hacia un modelo canonico.
3. Oferta canonica interna.
4. Transformacion de la oferta canonica hacia cada canal de distribucion.

Flujo recomendado:

```text
Cliente / ATS / XML / CSV / API
  -> SourceConnection
  -> RawJobRecord
  -> FieldMapping / Parser
  -> CanonicalJobOffer
  -> ValidationResult
  -> DistributionPackage por canal
```

## Modelo mental

La plataforma debe tener un idioma interno propio.

Cada cliente puede hablar distinto:

- Turijobs XML.
- CSV de una empresa pequena.
- API de un ATS.
- Google Sheet.
- XML de un job board.
- JSON custom.

Pero internamente todos deben terminar en un `CanonicalJobOffer`.

## Modelo canonico minimo

### Identidad

- `Id`: PK interna.
- `OrganizationId` o `UserId`: propietario.
- `SourceConnectionId`: conexion/fuente que trajo la oferta.
- `ExternalId`: ID de la oferta en el sistema origen.
- `SourceSystem`: nombre del sistema origen.
- `SourcePayloadHash`: hash para detectar cambios.
- `IngestionStatus`: `draft`, `valid`, `invalid`, `archived`.

### Contenido

- `Title`
- `DescriptionHtml`
- `DescriptionText`
- `RequirementsText`
- `BenefitsText`
- `CompanyName`
- `CompanyExternalId`
- `CompanyLogoUrl`
- `ApplicationUrl`
- `ExternalUrl`

### Ubicacion

- `Country`
- `CountryCode`
- `Region`
- `City`
- `Postcode`
- `Address`
- `Latitude`
- `Longitude`
- `RemotePolicy`

### Clasificacion

- `Category`
- `Subcategory`
- `Seniority`
- `JobType`
- `ContractType`
- `WorkdayType`
- `Sector`

### Compensacion

- `SalaryRaw`
- `SalaryMin`
- `SalaryMax`
- `SalaryCurrency`
- `SalaryPeriod`
- `SalaryIsVisible`

### Operacion

- `Vacancies`
- `PublicationDate`
- `ExpirationDate`
- `Status`
- `Language`
- `CreatedAt`
- `UpdatedAt`

## Raw primero, canonico despues

Siempre guardar el registro original antes de transformar.

Tabla conceptual:

```text
RawJobRecords
  Id
  SourceConnectionId
  ExternalId
  RawPayload
  RawFormat
  PayloadHash
  ReceivedAt
  ProcessingStatus
  ErrorMessage
```

Ventajas:

- Reprocesar sin pedir otra vez el feed.
- Auditar errores.
- Cambiar mappings sin perder informacion.
- Comparar versiones.
- Evitar depender de LLM para recuperar datos perdidos.

## Mapping deterministico

Cada conexion debe tener un mapping versionado:

```text
FieldMappings
  SourceConnectionId
  SourcePath
  TargetField
  TransformType
  TransformConfig
  Required
  DefaultValue
```

Ejemplo para el XML compartido:

```text
job.id -> ExternalId
job.url -> ExternalUrl
job.title -> Title
job.content -> DescriptionHtml
job.category -> Category
job.subcategory -> Subcategory
job.companyid -> CompanyExternalId
job.company -> CompanyName
job.city -> City
job.idpais -> CountryCode/rawCountryId
job.postcode -> Postcode
job.region -> Region
job.salary -> SalaryRaw
job.jobtype -> JobType
job.num_vacancies -> Vacancies
job.company_logo_url -> CompanyLogoUrl
job.publication -> PublicationDate
```

## Uso correcto de IA

El LLM no debe estar en el camino critico de cada oferta.

Uso recomendado de IA:

- Sugerir mappings la primera vez que conectas una nueva fuente.
- Detectar campos equivalentes en un XML/CSV desconocido.
- Normalizar casos ambiguos por lote, no por cada request.
- Mejorar redaccion de ofertas cuando el usuario lo solicita.
- Clasificar ofertas cuando no existe categoria fiable.
- Extraer requisitos/beneficios desde descripciones ruidosas si hace falta.

Uso no recomendado de IA:

- Parsear cada oferta si el mapping ya existe.
- Convertir XML a JSON en cada importacion.
- Decidir campos obvios como title, city, company, url.
- Generar scores o valores ficticios para completar datos.

Regla practica:

```text
80-90% deterministico
10-20% IA asistida o bajo demanda
```

## Pipeline recomendado de ingesta

### 1. Detectar formato

- XML
- CSV
- JSON
- API
- manual

### 2. Extraer registros

Para XML:

- root collection: `jobs`
- item path: `job`

### 3. Aplicar mapping

Transformar cada registro a `CanonicalJobOffer`.

### 4. Validar

Validaciones minimas:

- tiene `ExternalId` o URL unica
- tiene `Title`
- tiene `DescriptionHtml` o `DescriptionText`
- tiene `CompanyName` o empresa asociada
- tiene ubicacion o remote policy

### 5. Normalizar

Ejemplos:

- limpiar HTML para `DescriptionText`
- parsear salario desde `SalaryRaw`
- convertir fechas
- convertir vacancies a numero
- mapear pais
- deduplicar por `SourceConnectionId + ExternalId`

### 6. Persistir

Upsert por:

```text
OrganizationId + SourceConnectionId + ExternalId
```

Si no hay `ExternalId`, usar hash estable de URL/titulo/empresa/ubicacion.

### 7. Preparar distribucion

Cada canal recibe un package propio:

```text
CanonicalJobOffer
  -> ChannelRules
  -> ChannelPayload
```

Ejemplo:

- Jooble puede requerir ciertos campos y formato.
- Talent puede requerir XML/feed.
- LinkedIn puede exigir taxonomias distintas.
- InfoJobs puede requerir IDs propios.

## Coste operativo

Para controlar coste:

- No usar LLM en imports recurrentes si el mapping ya esta aprobado.
- Cachear resultados de IA por hash de contenido.
- Ejecutar IA por lotes y solo en campos ambiguos.
- Usar reglas primero y IA solo como fallback.
- Guardar todas las decisiones del agente en `AgentRun`.
- Permitir que el usuario apruebe mappings sugeridos una vez.

## Implicacion para el XML compartido

Este XML es una buena muestra para construir el primer parser/mapping, pero no debe definir el modelo global.

Observaciones:

- Contiene 3.037 ofertas.
- Tiene campos exteriores estables.
- `content` trae HTML muy ruidoso.
- `salary` viene como texto libre.
- `jobtype` mezcla jornada y contrato.
- `region` mezcla ciudad/provincia.
- `idpais` no es un ISO country code.

Por tanto:

- Guardar `salary` original en `SalaryRaw`.
- Parsear `SalaryMin`, `SalaryMax`, `SalaryPeriod` cuando sea posible.
- Guardar `DescriptionHtml` y derivar `DescriptionText`.
- Mantener `ExternalId = job.id`.
- Mantener `SourceSystem = turijobs/bebee-feed` o similar.

## Decision para el trabajo actual

No importar datos historicos antiguos.

Siguiente trabajo recomendado:

1. Terminar `jobOffers` Supabase nativo.
2. Corregir/confirmar el schema real de `JobOffers`, especialmente PK y ownership.
3. Definir `CanonicalJobOffer`.
4. Crear o ajustar tablas para raw records + ofertas canonicas.
5. Implementar importer deterministico para el XML de referencia.
6. Validar con una carga pequena.
7. Solo despues cargar el feed completo.

## Decision sobre `JobOffers` vacia

La auditoria de `/job-offers` encontro que `JobOffers` tiene 0 filas en Supabase. Eso cambia la estrategia:

- No necesitamos migrar ofertas historicas.
- No debemos importar el XML de referencia hasta alinear el schema.
- Si `JobOffers.UserId` es UUID pero la auth actual usa `Users.Id` BIGINT, hay que resolverlo antes de cargar datos.
- Si no hay datos productivos, es mejor corregir la tabla ahora que arrastrar una inconsistencia durante todo el producto.

Contrato recomendado a corto plazo:

- Mantener compatibilidad con `Users.Id` BIGINT mientras la auth sea JWT propia.
- Usar `JobOffers.OfferId` como PK interna si ya es la PK real.
- Usar `ExternalId` solo para el ID del sistema origen.
- Usar `SourceConnectionId`/`ConnectionId` para identificar de donde vino la oferta.
- Dejar preparado `OrganizationId` para una migracion multi-tenant futura, pero no bloquear Fase 0 por eso.

## Pregunta abierta

Antes de implementar la ingesta real hay que decidir el propietario:

- `UserId` si la plataforma sigue por usuario.
- `OrganizationId` si se quiere multi-tenant real.

Recomendacion:

- Mantener `UserId` en el corto plazo por compatibilidad.
- Diseñar el modelo para introducir `OrganizationId` despues sin romperlo.
