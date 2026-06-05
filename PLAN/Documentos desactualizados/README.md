# Documentos desactualizados

Esta carpeta contiene auditorias, planes y propuestas que fueron utiles durante la refactorizacion, pero que ya no representan el estado actual del producto.

No se eliminan porque conservan contexto historico de decisiones, riesgos y alternativas evaluadas.

Para la documentacion vigente del proceso de importacion de ofertas, usar:

- `PLAN/FUNCIONAL_IMPORTACION_OFERTAS.md`
- `PLAN/TECNICO_IMPORTACION_OFERTAS.md`
- `PLAN/SCHEDULER_SETUP.md`

Motivo principal del archivo:

- El schema limpio ya fue ejecutado.
- `JobOfferSources` ya existe.
- `JobOffers` ya deduplica por `UserId + SourceSystem + ExternalId`.
- El import XML ya no depende del navegador como worker.
- Varias auditorias antiguas hablan de `JobOffers` vacia, schema legacy, adapter SQL Server o endpoints rotos que ya fueron corregidos.
