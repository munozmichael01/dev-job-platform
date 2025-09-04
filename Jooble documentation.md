# Jooble API - Auction Controller

## Antes de comenzar

Por favor, contacta a tu **manager dedicado** para obtener una clave API única en el siguiente formato:


| API key = XXXXX-XXXX-XXXX-XXXXX-XXXXXXXX |
| :-- |


***

## **Endpoints**

### Obtener estadísticas de un periodo

| Campo | Valor |
| :-- | :-- |
| **Request type** | `POST` |
| **Request URL** | `https://{country_code}.jooble.org/auction/api/{key}`<br>- **country_code**: código de país (dos letras) del panel de subastas. |
| **Body parameters** | *(ver ejemplo)* |
| **Response statuses** | *(detallado en ejemplos)* |
| **Response parameters** | *(detallado en ejemplos)* |

**Nota:** Si el precio por clic ha cambiado **N** veces durante el periodo especificado, la respuesta contendrá un arreglo de **N+1** subperiodos para cada precio de clic.

#### Ejemplo

| Tipo | Ejemplo |
| :-- | :-- |
| Request | `https://be.jooble.org/auction/api/XXXXX-XXXX-XXXX-XXXXX-XXXXXXXX` |
| Body | *(ver parámetros en ejemplo de código)* |
| Response | *(devuelto por API)* |


***

### Crear una campaña

| Campo | Valor |
| :-- | :-- |
| **Request type** | `POST` |
| **Request URL** | `https://{country_code}.jooble.org/auction/api/createCampaign/{key}`<br>- **country_code**: código país de tu panel de subastas. |
| **Body parameters** | *(body con datos de campaña)* |
| **Response statuses** | *(según API)* |

**Restricciones:**

1. No puedes usar más de 1 regla de segmentación tipo `16 (url)` por campaña.
2. No puedes usar **`4 (Region)`** y **`8 (RegionExclude)`** en la misma campaña.
3. No puedes usar **`32 (SegmentTag)`** junto con otras reglas.

#### Ejemplo

| Tipo | Ejemplo |
| :-- | :-- |
| Request | `https://be.jooble.org/auction/api/createCampaign/XXXXX-XXXX-XXXX-XXXXX-XXXXXXXX` |
| Body | *(JSON con parámetros de campaña)* |
| Response | *(Respuesta de la API)* |


***

### Editar una campaña

| Campo | Valor |
| :-- | :-- |
| **Request type** | `POST` |
| **Request URL** | `https://{country_code}.jooble.org/auction/api/editCampaign/{key}`<br>- **country_code**: código país de tu panel de subastas. |
| **Body parameters** | *(body con datos a modificar)* |
| **Response statuses** | *(según API)* |

#### Ejemplo

| Tipo | Ejemplo |
| :-- | :-- |
| Request | `https://be.jooble.org/auction/editCampaign/XXXXX-XXXX-XXXX-XXXXX-XXXXXXXX` |
| Body | *(JSON con cambios)* |
| Response | *(Respuesta de la API)* |


***

### **Estados de campaña**

| Código | Nombre | Descripción |
| :-- | :-- | :-- |
| 0 | InProgress | La campaña está en ejecución |
| 1 | Stopped | Campaña detenida, editable y se puede volver a ejecutar |
| 2 | Deleted | Campaña eliminada, editable y se puede volver a ejecutar |


***

### **Tipos de reglas de segmentación**

| Código | Nombre | Descripción | Ejemplo |
| :-- | :-- | :-- | :-- |
| 1 | Title | Título | `"My New Job"` |
| 2 | CompanyName | Nombre de empresa | `"My Company"` |
| 4 | Region | Región incluida | `"Lviv"` |
| 8 | RegionExclude | Región excluida | `"Kyiv"`<br>Para varias, usar coma: `"Kyiv,Kharkiv,Dnipro"` |
| 16 | Url | URL | `"exampleurl.example.com"` |
| 32 | SegmentTag | Etiqueta de segmento | `"exampleTag"` |
| 64 | TitleRegex | Filtrado con RegEx en título | `"/abc/"` |


***

## Ejemplo de código: Obtener estadísticas para un periodo (JavaScript)

```javascript
var url = "https://%country_code%.jooble.org/auction/api/";

// Clave API enviada por el manager
var key = "XXXXX-XXXX-XXXX-XXXXX-XXXXXXXX";

// Periodo de datos
var params = "{ from: '2020-05-15', to: '2020-05-31'}"

// Objeto XMLHttpRequest
var http = new XMLHttpRequest();

// Abrir conexión (true: asíncrono, false: síncrono)
http.open("POST", url + key, true);

// Cabeceras
http.setRequestHeader("Content-type", "application/json");

// Callback de cambio de estado
http.onreadystatechange = function() {
    if(http.readyState == 4 && http.status == 200) {
        alert(http.responseText);
    }
}

// Envío de la petición
http.send(params);
```


***
