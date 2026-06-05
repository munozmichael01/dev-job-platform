# Tareas Seguras Para Gemini

## Principio de uso

Gemini puede ayudar, pero solo con tareas acotadas. No debe tomar decisiones de arquitectura, migraciones, auth, permisos ni backend central.

## Archivos prohibidos por defecto

- `backend/index.js`
- `backend/src/db/`
- `backend/scripts/*.sql`
- `backend/package.json`
- `backend/package-lock.json`
- `frontend/lib/api.ts`, salvo que la tarea lo autorice explicitamente
- cualquier archivo de auth, middleware o permisos

## Tarea Gemini 1: Prototipo visual de empty state para candidatos

### Objetivo

Crear una propuesta visual reutilizable para un estado vacio de candidatos, sin conectarlo a backend ni modificar APIs.

### Archivos permitidos

- `frontend/app/candidatos/components/empty-candidates-state.tsx`

### Archivos prohibidos

- Cualquier archivo backend.
- `frontend/lib/api.ts`.
- `frontend/components/app-sidebar.tsx`.
- `frontend/app/candidatos/page.tsx`, salvo que se autorice despues.

### Input disponible

La plataforma futura tendra una seccion de candidatos, pero todavia no se ha aprobado el modelo de datos definitivo.

### Output esperado

Un componente React exportado por defecto que muestre:

- titulo claro
- descripcion corta
- llamada a la accion visual pero sin funcionalidad real
- estilo compatible con el dashboard oscuro actual

### Criterios de aceptacion

- No hace fetch.
- No usa datos mock globales.
- No cambia rutas.
- No cambia dependencias.
- No modifica archivos fuera de los permitidos.

### Que no debe hacer

- No crear tablas.
- No crear endpoints.
- No registrar rutas.
- No instalar paquetes.
- No tocar auth ni permisos.

## Tarea Gemini 2: Componente de tarjeta de agente

### Objetivo

Crear un componente UI aislado para representar un agente de IA en el dashboard.

### Archivos permitidos

- `frontend/components/agents/agent-card.tsx`

### Archivos prohibidos

- Backend completo.
- Migraciones SQL.
- API client.
- Sidebar.
- Routing.

### Output esperado

Componente `AgentCard` con props:

- `name`
- `description`
- `status`
- `primaryMetric`
- `onOpen`

### Criterios de aceptacion

- TypeScript estricto.
- Sin dependencias nuevas.
- Sin llamadas API.
- Sin side effects.
- Visualmente alineado con el dashboard actual.

## Tarea Gemini 3: Maqueta estatica de panel de agentes

### Objetivo

Crear una pantalla estatica de exploracion para agentes, sin integracion real.

### Archivos permitidos

- `frontend/app/agentes/page.tsx`
- `frontend/components/agents/agent-card.tsx`

### Condicion previa

Solo ejecutar si `AgentCard` ya fue revisado y aceptado.

### Criterios de aceptacion

- No modificar sidebar.
- No modificar API client.
- No crear backend.
- Usar datos locales dentro de la pagina.
- Dejar claro visualmente que es una vista preparatoria.
