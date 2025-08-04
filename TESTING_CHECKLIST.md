# 🧪 **CHECKLIST COMPLETO DE PRUEBAS - JOB PLATFORM**

## 📋 **Estado de Servidores**
- [ ] **Backend**: Puerto 3002 funcionando (`http://localhost:3002`)
- [ ] **Frontend**: Puerto 3007 funcionando con Turbopack (`http://localhost:3007`)
- [ ] **Base de Datos**: SQL Server conectado correctamente

---

## 🏠 **1. PÁGINA PRINCIPAL**
**URL**: `http://localhost:3007`

### Funcionalidades Básicas
- [ ] Página carga sin errores
- [ ] Sidebar se despliega correctamente  
- [ ] Navegación entre secciones funciona
- [ ] Tema dark/light (si está implementado)
- [ ] Logo y branding visible

---

## 👥 **2. SECCIÓN ADMIN**
**URL**: `http://localhost:3007/admin`

### Gestión de Usuarios
- [ ] Lista de usuarios carga correctamente
- [ ] Crear nuevo usuario
- [ ] Editar usuario existente
- [ ] Eliminar usuario
- [ ] Buscar/filtrar usuarios
- [ ] Paginación (si aplica)

### Validaciones
- [ ] Campos obligatorios validados
- [ ] Formato de email validado
- [ ] Contraseñas seguras requeridas

---

## 📊 **3. SECCIÓN MÉTRICAS**
**URL**: `http://localhost:3007/metricas`

### Dashboard Principal
- [ ] Gráficos cargan sin errores
- [ ] Datos se actualizan correctamente
- [ ] Filtros por fecha funcionan
- [ ] Exportar datos (si aplica)

### Métricas Específicas
- [ ] Métricas de conexiones
- [ ] Métricas de campañas
- [ ] Métricas de ofertas
- [ ] Performance de mapeos

### Validación de Datos
- [ ] Verificar que las métricas coinciden con datos reales
- [ ] Comprobar que los gráficos se actualizan al cambiar filtros
- [ ] Validar cálculos de ROI y CPA
- [ ] Verificar exportación de reportes (si existe)

---

## 💼 **4. SECCIÓN OFERTAS**
**URL**: `http://localhost:3007/ofertas`

### Gestión de Ofertas
- [ ] Lista de ofertas carga correctamente
- [ ] Crear nueva oferta
- [ ] Editar oferta existente
- [ ] Eliminar oferta
- [ ] Buscar/filtrar ofertas
- [ ] Loading states funcionan

### Validaciones
- [ ] Título requerido
- [ ] Descripción válida
- [ ] Salario en formato correcto
- [ ] Fecha de publicación válida

---

## 🎯 **5. SECCIÓN CAMPAÑAS**
**URL**: `http://localhost:3007/campanas`

### Gestión de Campañas
- [ ] Lista de campañas carga correctamente
- [ ] Crear nueva campaña (`/campanas/nueva`)
- [ ] Editar campaña existente
- [ ] Eliminar campaña
- [ ] Activar/desactivar campaña

### Configuración de Campañas
- [ ] Seleccionar ofertas para campaña
- [ ] Configurar segmentos objetivo
- [ ] Programar envíos
- [ ] Vista previa de campaña

---

## 👥 **6. SECCIÓN SEGMENTOS**
**URL**: `http://localhost:3007/segmentos`

### Gestión de Segmentos
- [ ] Lista de segmentos carga correctamente
- [ ] Crear nuevo segmento (`/segmentos/nuevo`)
- [ ] Editar segmento existente
- [ ] Eliminar segmento
- [ ] Vista previa de audiencia

### Configuración de Segmentos
- [ ] Criterios de filtrado
- [ ] Lógica AND/OR
- [ ] Validación de sintaxis
- [ ] Estimación de tamaño

---

## 🔗 **7. SECCIÓN CONEXIONES**
**URL**: `http://localhost:3007/conexiones`

### Gestión Básica de Conexiones
- [ ] **GET** `/api/connections` - Listar todas las conexiones
- [ ] **GET** `/api/connections/3` - Obtener detalles de conexión específica
- [ ] **POST** `/api/connections` - Crear nueva conexión
- [ ] **PUT** `/api/connections/3` - Actualizar conexión existente
- [ ] **DELETE** `/api/connections/3` - Eliminar conexión

### Frontend de Conexiones
- [ ] Lista de conexiones carga correctamente
- [ ] Crear nueva conexión (formulario)
- [ ] Editar conexión existente
- [ ] Eliminar conexión (confirmación)
- [ ] Estados de conexión (activa/inactiva)

### Gestión de Field Mappings
**URL**: `http://localhost:3007/conexiones/[id]/mapeo`

- [ ] **GET** `/api/connections/3/mapping` - Obtener mapeos actuales
- [ ] **GET** `/api/connections/3/mappings` - Obtener mapeos (endpoint alternativo)
- [ ] **POST** `/api/connections/3/mapping` - Guardar nuevos mapeos
- [ ] **PUT** `/api/connections/3/mapping/1` - Actualizar mapeo específico
- [ ] **DELETE** `/api/connections/3/mapping/1` - Eliminar mapeo específico

### Frontend de Mapeos
- [ ] Página de mapeo carga sin errores
- [ ] Formulario de mapeo funcional
- [ ] Autocompletado de campos
- [ ] Validación de mapeos
- [ ] Guardar mapeos exitosamente

### Carga de Archivos
- [ ] **POST** `/api/connections/3/upload` - Subir archivo CSV/Excel real
- [ ] **POST** `/api/connections/3/test-upload` - Endpoint de prueba de carga

### Frontend de Upload
- [ ] Drag & drop funcional
- [ ] Seleccionar archivos funcional
- [ ] Progress bar durante upload
- [ ] Manejo de errores de upload
- [ ] Vista previa de datos cargados

### Pruebas de Validación
- [ ] Probar con archivos CSV válidos
- [ ] Probar con archivos Excel válidos  
- [ ] Probar con archivos inválidos (formato incorrecto)
- [ ] Probar con conexión inexistente (ID que no existe)
- [ ] Probar mapeos con campos válidos e inválidos

### Casos Límite
- [ ] Archivos muy grandes
- [ ] Archivos vacíos
- [ ] Caracteres especiales en nombres de campos
- [ ] Conexiones sin mapeos configurados

### Casos Edge Críticos
- [ ] Probar con archivo CSV con caracteres especiales (ñ, acentos)
- [ ] Probar con archivo Excel muy grande (>10MB)
- [ ] Verificar timeout en conexiones lentas
- [ ] Probar mapeo cuando faltan campos obligatorios

---

## 🔄 **8. NAVEGACIÓN Y ESTADO**

### Consistencia General
- [ ] Navegación funciona desde cualquier página
- [ ] Estados de loading se muestran correctamente
- [ ] Mensajes de error son claros y útiles
- [ ] Breadcrumbs funcionan en páginas profundas

---

## 🧪 **9. SECCIÓN TEST-API**
**URL**: `http://localhost:3007/test-api`

### Pruebas de Integración
- [ ] Todas las llamadas API funcionan
- [ ] Manejo de errores correcto
- [ ] Timeouts manejados apropiadamente
- [ ] Autenticación funcional (si aplica)

---

## ⚡ **10. PRUEBAS DE RENDIMIENTO**

### Carga de Páginas
- [ ] Tiempo de carga inicial < 3 segundos
- [ ] Navegación entre páginas fluida
- [ ] Imágenes optimizadas
- [ ] Lazy loading funcional

### Optimización
- [ ] Turbopack funcionando correctamente
- [ ] Hot reload funcional en desarrollo
- [ ] Bundle size apropiado
- [ ] Tree shaking efectivo

---

## 🌐 **11. PRUEBAS CROSS-BROWSER**

### Navegadores de Escritorio
- [ ] Chrome (últimas 2 versiones)
- [ ] Firefox (últimas 2 versiones)
- [ ] Safari (últimas 2 versiones)
- [ ] Edge (últimas 2 versiones)

### Dispositivos Móviles
- [ ] Responsive design funcional
- [ ] Touch interactions
- [ ] Viewport meta tag correcto

---

## 🔒 **12. SEGURIDAD**

### Validaciones
- [ ] Input sanitization
- [ ] SQL injection prevention
- [ ] XSS protection
- [ ] CORS configurado correctamente

### Autenticación
- [ ] Login/logout funcional
- [ ] Sesiones manejadas correctamente
- [ ] Tokens de seguridad válidos

---

## 📝 **13. PRUEBAS DE REGRESIÓN**

### Después de Cambios
- [ ] Todas las funcionalidades existentes siguen funcionando
- [ ] No hay errores de consola nuevos
- [ ] Performance no se ha degradado
- [ ] Tests automatizados pasan (si existen)

---

## 🚀 **COMANDOS ÚTILES**

### Desarrollo
```bash
# Frontend con Turbopack
cd frontend && npm run dev -- --port 3007 --turbo

# Backend
cd backend && npm run dev

# Base de datos (si aplica)
npm run db:migrate
npm run db:seed
```

### Testing
```bash
# Tests unitarios
npm test

# Tests e2e
npm run test:e2e

# Linting
npm run lint

# Typecheck
npm run typecheck
```

---

## ✅ **CRITERIOS DE ACEPTACIÓN**

Una sección está **COMPLETAMENTE PROBADA** cuando:
- ✅ Todas las funcionalidades básicas funcionan
- ✅ Validaciones están en su lugar
- ✅ Manejo de errores es apropiado
- ✅ UI/UX es consistente
- ✅ Performance es aceptable
- ✅ No hay errores de consola

---

**📅 Fecha de última actualización**: 2025-07-27  
**🔄 Estado del checklist**: En progreso  
**👤 Responsable**: Equipo de desarrollo