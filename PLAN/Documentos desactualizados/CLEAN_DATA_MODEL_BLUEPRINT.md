# Blueprint de Modelo de Datos Limpio

## Decision

Vamos a dejar de intentar rescatar datos o estructuras que ya no son relevantes.

La plataforma debe partir de un modelo limpio, logico y preparado para:

- ingesta de ofertas desde multiples clientes/fuentes
- normalizacion canonica
- segmentacion
- campanas
- distribucion por canales
- agentes de IA
- candidatos y matching en fases posteriores

Como `JobOffers` esta vacia, no hay que proteger datos historicos. Eso nos permite corregir el esquema antes de cargar el primer feed real.

## Principios

1. Primero modelo canonico, luego datos.
2. Raw data siempre se guarda antes de transformar.
3. `ExternalId` nunca es PK interna.
4. Las ofertas pertenecen a un tenant/cliente, no solo a una tabla suelta.
5. Segmentos y campanas deben operar sobre ofertas canonicas.
6. Los canales tienen requirements distintos; se transforman desde el modelo canonico hacia cada canal.
7. IA como enriquecimiento/asistencia, no como parser obligatorio de cada oferta.

## Fase 0: entidades base

### Organizations

Representa el cliente/empresa que usa la plataforma.

Campos:

- `Id`
- `Name`
- `Slug`
- `Country`
- `Timezone`
- `Status`
- `CreatedAt`
- `UpdatedAt`

Nota:

- Aunque hoy la auth use `UserId`, el modelo limpio debe preparar multi-tenant real.

### Users

Representa usuarios humanos.

Campos:

- `Id`
- `OrganizationId`
- `Email`
- `PasswordHash`
- `FirstName`
- `LastName`
- `Role`
- `IsActive`
- `CreatedAt`
- `UpdatedAt`

Roles iniciales:

- `superadmin`
- `admin`
- `recruiter`
- `viewer`

## Fase 1: conexiones e ingesta

### SourceConnections

Representa una fuente de ofertas de un cliente.

Ejemplos:

- XML Turijobs/Bebee
- API de ATS
- CSV manual
- Google Sheet
- XML propio del cliente

Campos:

- `Id`
- `OrganizationId`
- `Name`
- `Type`: `xml`, `csv`, `json_api`, `manual`, `sheet`
- `SourceSystem`
- `Url`
- `AuthType`
- `AuthConfigEncrypted`
- `ScheduleEnabled`
- `ScheduleFrequency`
- `LastSyncAt`
- `Status`
- `CreatedAt`
- `UpdatedAt`

### RawJobRecords

Guarda cada oferta original tal como vino.

Campos:

- `Id`
- `OrganizationId`
- `SourceConnectionId`
- `ExternalId`
- `RawFormat`
- `RawPayload`
- `PayloadHash`
- `ReceivedAt`
- `ProcessingStatus`
- `ProcessingError`

Unique recomendado:

- `SourceConnectionId + ExternalId`

Si no hay `ExternalId`, usar:

- `SourceConnectionId + PayloadHash`

### FieldMappings

Mapping versionado de fuente a modelo canonico.

Campos:

- `Id`
- `OrganizationId`
- `SourceConnectionId`
- `Version`
- `SourcePath`
- `TargetField`
- `TransformType`
- `TransformConfig`
- `Required`
- `DefaultValue`
- `CreatedAt`
- `UpdatedAt`

Ejemplo:

```text
job.id -> ExternalId
job.title -> Title
job.content -> DescriptionHtml
job.company -> CompanyName
job.salary -> SalaryRaw
```

## Fase 2: ofertas canonicas

### JobOffers

Oferta interna normalizada.

Campos de identidad:

- `Id`
- `OrganizationId`
- `SourceConnectionId`
- `RawJobRecordId`
- `ExternalId`
- `SourceSystem`
- `PayloadHash`

Campos de contenido:

- `Title`
- `DescriptionHtml`
- `DescriptionText`
- `RequirementsText`
- `BenefitsText`
- `ApplicationUrl`
- `ExternalUrl`

Empresa:

- `CompanyName`
- `CompanyExternalId`
- `CompanyLogoUrl`

Ubicacion:

- `Country`
- `CountryCode`
- `Region`
- `City`
- `Postcode`
- `Address`
- `Latitude`
- `Longitude`
- `RemotePolicy`

Clasificacion:

- `Sector`
- `Category`
- `Subcategory`
- `JobType`
- `ContractType`
- `WorkdayType`
- `Seniority`

Salario:

- `SalaryRaw`
- `SalaryMin`
- `SalaryMax`
- `SalaryCurrency`
- `SalaryPeriod`
- `SalaryIsVisible`

Operacion:

- `Vacancies`
- `PublicationDate`
- `ExpirationDate`
- `Status`
- `Language`
- `CreatedAt`
- `UpdatedAt`

Unique recomendado:

- `OrganizationId + SourceConnectionId + ExternalId`

Nota sobre nombres:

- En el modelo limpio preferimos `Id` como PK.
- Si mantenemos compatibilidad temporal con `OfferId`, debe ser una decision explicita de migracion, no el modelo deseado.

## Fase 3: segmentacion

### Segments

Un segmento es una seleccion dinamica o estatica de ofertas.

Campos:

- `Id`
- `OrganizationId`
- `Name`
- `Description`
- `Type`: `dynamic`, `static`
- `FilterDefinition`
- `Status`
- `CreatedByUserId`
- `CreatedAt`
- `UpdatedAt`

Ejemplo de `FilterDefinition`:

```json
{
  "country": "ES",
  "sector": ["Sala", "Mantenimiento"],
  "city": ["Madrid", "Barcelona"],
  "status": "active"
}
```

### SegmentJobOffers

Solo necesario para segmentos estaticos o snapshots.

Campos:

- `SegmentId`
- `JobOfferId`
- `AddedAt`

## Fase 4: campanas

### Campaigns

Una campana agrupa distribucion de un segmento hacia canales.

Campos:

- `Id`
- `OrganizationId`
- `Name`
- `Description`
- `SegmentId`
- `Objective`
- `BudgetTotal`
- `BudgetCurrency`
- `StartDate`
- `EndDate`
- `Status`
- `CreatedByUserId`
- `CreatedAt`
- `UpdatedAt`

Estados:

- `draft`
- `active`
- `paused`
- `completed`
- `archived`

### CampaignChannels

Canales habilitados para una campana.

Campos:

- `Id`
- `CampaignId`
- `ChannelId`
- `Budget`
- `BidStrategy`
- `Status`
- `Config`
- `CreatedAt`
- `UpdatedAt`

## Fase 5: canales y distribucion

### DistributionChannels

Catalogo de canales.

Campos:

- `Id`
- `Code`
- `Name`
- `Type`
- `Country`
- `IsActive`
- `RequirementsSchema`
- `CreatedAt`
- `UpdatedAt`

Ejemplos:

- `jooble`
- `talent`
- `jobrapido`
- `whatjobs`
- `infojobs`
- `linkedin`

### ChannelCredentials

Credenciales por organizacion y canal.

Campos:

- `Id`
- `OrganizationId`
- `ChannelId`
- `Name`
- `CredentialsEncrypted`
- `Status`
- `CreatedAt`
- `UpdatedAt`

### DistributionRuns

Ejecucion de distribucion.

Campos:

- `Id`
- `OrganizationId`
- `CampaignId`
- `ChannelId`
- `Status`
- `StartedAt`
- `FinishedAt`
- `ErrorMessage`
- `CreatedAt`

### DistributionItems

Resultado por oferta/canal.

Campos:

- `Id`
- `DistributionRunId`
- `JobOfferId`
- `ChannelId`
- `ExternalChannelId`
- `Status`
- `Payload`
- `Response`
- `ErrorMessage`
- `CreatedAt`
- `UpdatedAt`

## Fase 6: metricas

### PerformanceMetrics

Metricas por oferta/campana/canal.

Campos:

- `Id`
- `OrganizationId`
- `JobOfferId`
- `CampaignId`
- `ChannelId`
- `MetricDate`
- `Impressions`
- `Clicks`
- `Applications`
- `Spend`
- `Currency`
- `CreatedAt`

## Fase 7: agentes

### AgentRuns

Campos:

- `Id`
- `OrganizationId`
- `AgentType`
- `EntityType`
- `EntityId`
- `InputHash`
- `InputSnapshot`
- `Output`
- `Model`
- `PromptVersion`
- `Status`
- `CostEstimate`
- `CreatedByUserId`
- `CreatedAt`

### AgentRecommendations

Campos:

- `Id`
- `AgentRunId`
- `OrganizationId`
- `EntityType`
- `EntityId`
- `RecommendationType`
- `Recommendation`
- `Confidence`
- `Status`: `pending`, `accepted`, `rejected`, `expired`
- `ReviewedByUserId`
- `ReviewedAt`
- `CreatedAt`

## Fase 8: candidatos, despues

No implementar hasta estabilizar ingesta/distribucion.

Entidades futuras:

- `Candidates`
- `Applications`
- `Interviews`
- `CandidateEvaluations`
- `RecruiterReports`

## Orden recomendado de implementacion

1. Definir `Organizations` y alinear `Users`.
2. Crear `SourceConnections`.
3. Crear `RawJobRecords`.
4. Crear `FieldMappings`.
5. Redefinir `JobOffers` limpia.
6. Implementar importer XML deterministico usando el feed compartido.
7. Crear `Segments`.
8. Crear `Campaigns`.
9. Crear `DistributionChannels` y `CampaignChannels`.
10. Crear `DistributionRuns`/`DistributionItems`.
11. Agregar metricas.
12. Agregar agentes.
13. Agregar candidatos.

## Decision sobre datos

No rescatar datos antiguos de ofertas.

Si hay tablas antiguas con datos utiles de usuarios, conexiones o credenciales, se pueden migrar selectivamente.

Pero para ofertas, segmentos y campanas nuevas:

- crear desde cero
- insertar datos reales desde fuentes nuevas
- validar el pipeline completo
- evitar mocks persistidos

## Nota para Claude

Antes de implementar SQL:

- no ejecutar migraciones destructivas sin backup
- confirmar si `Users.Id` existe y es BIGINT
- confirmar si `Users.UserId` UUID sigue existiendo en alguna tabla
- decidir compatibilidad temporal con frontend actual
- separar migration SQL de importer
