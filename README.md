# Job Platform

Plataforma de gestión y distribución de ofertas de empleo para clientes (portales, agencias, empresas).

---

## Estructura del Proyecto

```
job-platform/
│
├── backend/      # API, lógica de negocio, importadores/exportadores, Swagger
│   └── src/      # Código fuente principal del backend
│
└── frontend/     # Aplicación web (Next.js)
    └── app/      # Código fuente principal del frontend
```

---

## Requisitos Previos
- Node.js 18+
- npm o yarn
- Base de datos SQL Server (configurada en backend)

---

## 1. Levantar el Backend

```
cd backend
npm install
npm run dev
```

- El backend corre por defecto en `http://localhost:3000`
- Documentación Swagger disponible en `/swagger` (por ejemplo, `http://localhost:3000/swagger`)
- Configura la base de datos en `backend/src/db/db.js` y variables de entorno si es necesario.

---

## 2. Levantar el Frontend

```
cd frontend
npm install
npm run dev
```

- El frontend corre por defecto en `http://localhost:3001` (o el puerto configurado en Next.js)
- Configura la URL del backend en `frontend/.env.local`:
  ```
  NEXT_PUBLIC_API_URL=http://localhost:3000
  ```

---

## 3. Variables de Entorno

- **Frontend:**
  - `NEXT_PUBLIC_API_URL`: URL base del backend.
- **Backend:**
  - Variables de conexión a la base de datos (pueden ir en `.env` o directamente en `db.js`).

---

## 4. Scripts y Funcionalidad Principal

### Backend
- **src/routes/connections.js**: Endpoints REST para gestionar conexiones de datos (XML, API, Manual).
- **src/processors/apiProcessor.js / xmlProcessor.js**: Procesan la importación de ofertas desde APIs o feeds XML.
- **src/db/db.js**: Conexión y pool a SQL Server.
- **importOffersFromAPI.js, importOffers.js, fetchFromAPI.js**: Scripts para importar ofertas desde fuentes externas.
- **exporters/talent/TalentExporter.js**: Exporta ofertas a Talent u otros agregadores.
- **test-db-connection.js**: Prueba la conexión a la base de datos.

### Frontend
- **app/**: Componentes y páginas principales de la UI.
- **lib/api.js**: (Recomendado) Centraliza las llamadas a la API del backend.

---

## 5. Flujo de Desarrollo Recomendado

1. Levanta backend y frontend en paralelo.
2. Usa variables de entorno para conectar ambos entornos.
3. Realiza llamadas a la API desde el frontend usando la URL configurada.
4. Consulta la documentación Swagger para ver los endpoints disponibles.
5. Usa los scripts de importación/exportación según sea necesario.

---

## 6. Documentación de la API

- Consulta `backend/swagger.yaml` o accede a `/swagger` en el backend para ver todos los endpoints, ejemplos y modelos de datos.

---

## 7. Contacto y Soporte

- Para dudas técnicas, revisa este README y la documentación Swagger.
- Si necesitas ayuda adicional, contacta al responsable del proyecto o al equipo de desarrollo. 