# Documento funcional — Importacion de ofertas

Fecha de cierre: 2026-06-05
Estado: funcionalidad operativa MVP

## Objetivo

La funcionalidad de importacion permite que un usuario conecte una fuente externa de ofertas y que TalentOS convierta esos datos en ofertas canonicas, sin duplicados, listas para ser usadas por busquedas, segmentos, campanas y distribucion.

El usuario no debe quedarse en la pagina para que el proceso termine. La importacion se ejecuta en segundo plano mediante un scheduler y la interfaz solo muestra el estado.

## Alcance funcional cerrado

Esta fase cubre:

- Importacion de ofertas desde feeds XML por URL.
- Carga inicial de feeds grandes por lotes.
- Procesamiento automatico en segundo plano.
- Dedupe canonico de ofertas.
- Relacion de una misma oferta con multiples conexiones fuente.
- Reanudacion de imports interrumpidos usando cola persistida.
- Actualizacion diaria/orientada por frecuencia de conexiones.
- Pausa o archivo de ofertas que desaparecen del feed.
- Visualizacion de estado en la pantalla de conexiones.

## Flujo de usuario

1. El usuario crea o activa una conexion de tipo XML.
2. La conexion queda configurada con una URL de feed y una frecuencia, por ejemplo `daily`.
3. El usuario puede pulsar `Sync` o simplemente esperar al scheduler.
4. El sistema descarga el XML y guarda las ofertas crudas en cola.
5. El sistema procesa la cola por lotes en segundo plano.
6. La interfaz muestra si la conexion esta activa, en cola, importando o en error.
7. Al terminar, la conexion queda activa y muestra el numero de ofertas importadas desde esa fuente.

## Comportamiento visible en UI

La pantalla `/conexiones` muestra:

- Total de conexiones.
- Conexiones activas.
- Ofertas importadas.
- Errores totales.
- Estado por conexion.
- Fecha de ultima sincronizacion.
- Numero de ofertas asociadas a cada conexion.

Estados principales:

| Estado | Significado funcional |
|---|---|
| `Activa` | La conexion esta disponible y no tiene trabajo pendiente. |
| `En cola` | Hay ofertas pendientes de procesar; el scheduler las procesara. |
| `Importando...` | La pagina esta observando una importacion activa. |
| `Error` | La conexion requiere revision manual. |

La UI debe comunicar que el usuario puede salir de la pagina y que el sistema seguira procesando automaticamente.

## Reglas de negocio

### Oferta canonica unica

Una misma oferta no puede existir duplicada en el producto.

Si dos conexiones traen la misma oferta del mismo sistema origen, TalentOS crea una sola oferta canonica y registra que esa oferta fue vista en ambas conexiones.

Ejemplo:

```text
Conexion A trae oferta 327903
Conexion B trae oferta 327903

Resultado:
JobOffers: 1 oferta canonica
JobOfferSources: 2 vinculos, uno por conexion
```

### Identidad externa

- `JobOffers.Id` es el ID interno canonico de TalentOS.
- `ExternalId` es el ID de la oferta en el sistema origen.
- `JobOfferSources` registra el vinculo entre conexion, proveedor y `ExternalId`.

### Fuente de verdad para una oferta

La oferta canonica vive en `JobOffers`.

La informacion de que una oferta vino de una conexion especifica vive en `JobOfferSources`.

### Si una oferta desaparece del feed

Cuando una conexion se sincroniza de nuevo y una oferta que antes estaba ya no aparece:

| Caso | Resultado |
|---|---|
| La oferta no vencio | Se pausa en esa fuente. |
| La oferta ya vencio | Se archiva en esa fuente. |
| Otra fuente sigue enviando la misma oferta | La oferta canonica sigue activa. |
| Ninguna fuente activa sigue enviandola | La oferta canonica se pausa o archiva. |

Esto evita apagar una oferta solo porque desaparecio de una conexion si todavia esta vigente en otra.

## Scheduler y automatizacion

El procesamiento no depende del navegador.

La arquitectura funcional es:

```text
Usuario o scheduler inicia import
        |
        v
RawJobRecords guarda ofertas crudas
        |
        v
Scheduler procesa lotes en segundo plano
        |
        v
JobOffers + JobOfferSources actualizados
        |
        v
UI consulta estado
```

Se usa:

- Vercel Cron diario como respaldo.
- `cron-job.org` cada 5 minutos para drenar trabajos pendientes y ejecutar sincronizaciones.

## Resultado esperado para el negocio

Para el usuario, el comportamiento deseado es:

```text
Conectar fuente
Sincronizar
Ver ofertas importadas
Sistema actualiza solo
```

El usuario no debe conocer lotes, cron, cola ni deduplicacion interna.

## Lo que no esta cerrado en esta fase

### Mapeo universal de campos

Esta fase NO cierra el flujo completo de mapeo universal.

Estado actual:

- Existe autodeteccion para XML tipo Turijobs/Bebee.
- Existe soporte tecnico para `FieldMappings` por conexion.
- El importador puede usar mappings cuando existen.

Pendiente para fase siguiente:

- Detectar campos de cualquier XML, CSV, Excel o API.
- Sugerir mapping inicial automaticamente.
- Permitir que el usuario confirme o edite el mapping.
- Guardar el mapping versionado por conexion.
- Validar campos obligatorios antes de importar.
- Reprocesar registros usando un mapping corregido.

### CSV, Excel y API

La arquitectura ya contempla fuentes no XML, pero esta fase cierra principalmente el flujo XML por URL. CSV, Excel y API deben cerrarse en fases propias con el mismo contrato canonico.

## Criterio de cierre de esta fase

La fase se considera cerrada cuando:

- Un feed XML grande se importa sin depender del navegador.
- Las conexiones pendientes se drenan por scheduler externo.
- No hay duplicados canonicos en `JobOffers`.
- Una misma oferta puede estar asociada a varias conexiones por `JobOfferSources`.
- El frontend muestra estados coherentes.
- La documentacion funcional y tecnica queda actualizada.
