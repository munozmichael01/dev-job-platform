# Plan — Ubicaciones universales

Fecha: 2026-06-05
Estado: propuesta para fase siguiente

## Por que importa

La ubicacion es un campo critico para ofertas de empleo. Sin ubicacion fiable no se puede:

- publicar correctamente en canales externos;
- segmentar ofertas por mercado;
- distribuir presupuesto por ciudad o pais;
- evitar errores de matching;
- reportar performance geografica.

La ubicacion debe tratarse como dato estructurado, no solo como texto libre.

## Estado actual

El modelo actual de `JobOffers` guarda:

- `Country`
- `CountryCode`
- `Region`
- `City`
- `Postcode`
- `Address`
- `Latitude`
- `Longitude`
- `RemotePolicy`

El import XML Turijobs/Bebee ya intenta mapear campos como `city`, `region`, `country`, `idpais`, `postcode`, `address`, `latitude`, `longitude`.

La UI de ofertas y segmentos muestra ubicaciones como:

```text
City, Region
```

## Bug corregido en esta fase

El filtro de ubicacion fallaba cuando el valor contenia coma, por ejemplo:

```text
Madrid, Comunidad de Madrid
```

La causa era que el backend insertaba ese valor completo dentro de filtros `.or(...)` de PostgREST. En PostgREST, la coma separa condiciones, asi que la ubicacion rompia el parser o devolvia resultados incorrectos.

Correccion aplicada:

- En ofertas, el filtro de ubicacion divide `City, Region` y filtra de forma estructural.
- En segmentos, el filtro de ubicacion tambien divide `City, Region`.
- Segmentos ahora puede evaluar varias ubicaciones seleccionadas, no solo la primera.

## Criterio funcional

Para que una oferta sea publicable debe tener ubicacion suficiente.

Minimo recomendado:

| Tipo de oferta | Campos requeridos |
|---|---|
| Presencial | `Country` + `City` |
| Hibrida | `Country` + `City` + `RemotePolicy='hybrid'` |
| Remota dentro de pais | `Country` + `RemotePolicy='remote'` |
| Remota global | `RemotePolicy='remote'` + regla explicita de pais/region permitida |

No deberiamos publicar ofertas sin ubicacion salvo que el canal acepte remoto global y la oferta lo indique claramente.

## Problema universal

Cada fuente puede representar ubicaciones de forma distinta:

| Fuente | Ejemplo |
|---|---|
| XML Turijobs | `city`, `region`, `country`, `idpais` |
| CSV cliente | `location`, `province`, `country_code` |
| ATS API | objeto `location: { city, state, country }` |
| Texto libre | `Madrid, Spain` |
| Remoto | `Remote`, `Teletrabajo`, `Work from home` |

Necesitamos normalizar todas esas variantes a un contrato canonico.

## Modelo recomendado

### Corto plazo

Mantener columnas actuales en `JobOffers`, pero agregar reglas de normalizacion en el import/mapping:

- `Country`: nombre legible.
- `CountryCode`: ISO-2 preferido, por ejemplo `ES`, `VE`, `MX`.
- `Region`: provincia, estado o comunidad autonoma.
- `City`: ciudad.
- `Postcode`: codigo postal si existe.
- `Address`: direccion si existe.
- `Latitude`/`Longitude`: opcionales.
- `RemotePolicy`: `onsite`, `hybrid`, `remote`.

### Medio plazo

Crear una tabla de referencia opcional:

```text
Locations
  Id
  CountryCode
  CountryName
  Region
  City
  NormalizedName
  Latitude
  Longitude
  ProviderPlaceId
```

Y en `JobOffers` agregar:

```text
LocationId nullable
LocationQuality
LocationRaw
```

Esto permitiria mantener el texto original y asociarlo a una ubicacion normalizada.

## Proceso recomendado de normalizacion

1. Preservar valor original en `RawJobRecords`.
2. Aplicar mapping de campos de la conexion.
3. Normalizar pais y ciudad con reglas deterministicas.
4. Detectar remoto/hibrido usando `RemotePolicy` o palabras clave.
5. Validar si la oferta es publicable.
6. Guardar warnings si falta ubicacion o si la ubicacion es ambigua.
7. Permitir correccion via mapping o reglas por conexion.

## Deteccion automatica inicial

Para la fase de mapping universal, la plataforma debe sugerir:

| Campo canonico | Posibles nombres origen |
|---|---|
| `City` | city, ciudad, location_city, localidad, municipio |
| `Region` | region, provincia, state, province, comunidad |
| `Country` | country, pais, país, location_country |
| `CountryCode` | country_code, idpais, iso_country, countryCode |
| `Postcode` | postcode, postal_code, zip, cp |
| `Address` | address, direccion, dirección |
| `RemotePolicy` | remote, work_mode, modalidad, teletrabajo |

El usuario debe poder confirmar o editar estas sugerencias una vez por conexion.

## Validaciones sugeridas

| Validacion | Severidad |
|---|---|
| Sin `City` y sin `RemotePolicy='remote'` | Error de publicabilidad |
| Sin `Country` ni `CountryCode` | Error de publicabilidad |
| `CountryCode` no ISO-2 | Warning o normalizacion |
| Ciudad en texto libre con multiples partes | Warning si no se puede separar |
| Remoto detectado pero con ciudad obligatoria del canal | Warning por canal |

## Impacto en segmentos y filtros

Los filtros de ubicacion deben operar sobre campos estructurados:

- ciudad;
- region;
- pais;
- modalidad remota/hibrida/presencial.

No deben depender de un string concatenado.

Para UI se puede mostrar `City, Region`, pero internamente conviene usar un valor estructurado o serializado de forma segura.

Ejemplo futuro:

```json
{
  "city": "Madrid",
  "region": "Comunidad de Madrid",
  "countryCode": "ES"
}
```

## Relacion con mapeo universal

La normalizacion universal de ubicaciones debe ir junto con la fase de mapeo universal.

No queda cerrada en la fase actual de import XML.

## Siguiente fase propuesta

1. Auditar datos actuales de ubicacion importados.
2. Identificar porcentaje con `City`, `Region`, `Country`, `CountryCode`.
3. Definir campos obligatorios por tipo de fuente y canal.
4. Ajustar `FieldMappings` para soportar ubicaciones estructuradas.
5. Crear sugeridor de mapping para ubicaciones.
6. Agregar validacion de publicabilidad antes de distribucion.
7. Evaluar `Locations` como tabla normalizada si el volumen/mercados lo justifican.
