# Revision Codex de la Propuesta de Schema

## Veredicto

La auditoria de Claude es buena y confirma el problema principal: `JobOffers` esta vacia y su schema actual no debe condicionar el producto.

Pero la propuesta SQL es demasiado conservadora con `Campaigns` y `Segments`. Eso contradice parcialmente la decision de producto actual: no rescatar estructuras antiguas si no representan el modelo que queremos construir.

## Decision de producto actual

- No migrar ofertas antiguas.
- No adaptar el producto a `JobOffers` legacy.
- No rescatar segmentos/campanas antiguas por defecto.
- Construir un modelo limpio y cargar datos desde cero.
- Conservar usuarios y conexiones utiles.
- Exportar/respaldar datos antiguos antes de reemplazarlos, pero no tratarlos como verdad del nuevo producto.

## Evaluacion por bloque

### Users

Decision: conservar.

Motivo:

- Hay usuarios reales.
- La auth JWT actual depende de `Users.Id` BIGINT.

Accion:

- Mantener `Users.Id`.
- Agregar `OrganizationId` solo si se define una organization default.
- No migrar a Supabase Auth ahora.

### Connections

Decision: conservar de momento.

Motivo:

- Hay 89 conexiones.
- Pueden contener URLs reales utiles.

Accion:

- No dropear.
- Auditar cuales conexiones siguen vigentes.
- Crear `SourceConnections` nuevo o migrar progresivamente `Connections` hacia ese concepto.

### JobOffers

Decision: reemplazar.

Motivo:

- 0 filas.
- Schema incompatible.
- Es el nucleo del producto y debe quedar limpio.

Accion:

- DROP + CREATE aprobado, previa validacion `COUNT(*) = 0`.
- Usar PK limpia `Id`.
- `ExternalId` solo como ID externo.
- `UserId` BIGINT mientras la auth sea JWT propia.
- Preparar `OrganizationId` opcional o nullable si se decide.

### Segments

Decision recomendada: no conservar como base obligatoria.

Motivo:

- Hay 17 segmentos, pero `OfferCount=0`.
- Si no hay `JobOffers`, esos segmentos no representan segmentacion real actual.
- Pueden estar ligados a datos/mocks/desarrollo.

Accion recomendada:

- Exportar/respaldar.
- Crear una tabla nueva limpia o recrear `Segments`.
- Si se conservan temporalmente, marcarlos como legacy o draft, no usarlos como base del nuevo flujo.

### Campaigns

Decision recomendada: no conservar como base obligatoria.

Motivo:

- Hay 15 campanas, pero sin ofertas reales canonicas.
- `Channels` es JSON string crudo.
- El nuevo modelo necesita `CampaignChannels`, `DistributionRuns` y `DistributionItems`.

Accion recomendada:

- Exportar/respaldar.
- Crear nuevas campanas desde cero despues de cargar ofertas reales.
- No migrar `Channels` JSON hacia `CampaignChannels` hasta confirmar que esas campanas tienen valor.

### FieldMappings

Decision: limpiar o recrear.

Motivo:

- Hay 3 filas apuntando a `ConnectionId=2099` inexistente.
- Eso suena a testing.

Accion:

- No conservar por defecto.
- Crear mappings nuevos para el XML de referencia.

### ChannelCredentials

Decision: reemplazar.

Motivo:

- Tabla actual vacia.
- Nuevo modelo necesita FK a canales.

## Ajuste recomendado al SQL de Claude

La propuesta `backend/scripts/proposed-clean-schema.sql` debe dividirse en dos variantes:

### Variante A: conservadora

Mantiene `Segments` y `Campaigns`, les agrega columnas nuevas.

Uso:

- Si el usuario confirma que esos 17 segmentos y 15 campanas son utiles.

### Variante B: clean slate recomendada

Recrea o archiva `Segments`, `Campaigns`, `CampaignChannels`, `FieldMappings`, `JobOffers`.

Uso:

- Si la prioridad es construir el modelo limpio desde cero.

Esta es la variante recomendada por Codex para el estado actual del producto.

## Reglas antes de ejecutar cualquier SQL

1. Backup/export manual de `Users`, `Connections`, `Campaigns`, `Segments` y `FieldMappings`.
2. Confirmar `JobOffers = 0`.
3. Confirmar si las campanas/segmentos son datos reales o de desarrollo.
4. No ejecutar `DROP` sin aprobacion explicita del usuario.
5. No importar XML hasta que el schema limpio este aprobado.
6. No mezclar migracion de schema con importer.

## Siguiente paso recomendado

Pedir a Claude que ajuste la propuesta para una estrategia clean slate:

- Mantener `Users`.
- Mantener `Connections` como fuente legacy util.
- Reemplazar `JobOffers`.
- Reemplazar o archivar `Segments`.
- Reemplazar o archivar `Campaigns`.
- Reemplazar `FieldMappings`.
- Crear pipeline limpio de ingesta/distribucion.

No ejecutar aun.
