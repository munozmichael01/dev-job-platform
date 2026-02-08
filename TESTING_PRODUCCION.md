# 🧪 Testing Sistemático - Job Platform en Producción

**Fecha:** 2026-02-08
**Entorno:** Vercel Production

---

## 🌐 **URLs del Sistema**

```
✅ Landing:  https://landing-page-chi-one-12.vercel.app
✅ Frontend: https://dev-job-platform-frontend.vercel.app
✅ Backend:  https://dev-job-platform-backend.vercel.app
```

---

## ✅ **SECCIÓN 1: AUTENTICACIÓN**

### 1.1 Login desde Frontend
- [ ] Abrir: https://dev-job-platform-frontend.vercel.app/login
- [ ] Ingresar: `michael.munoz@turijobs.com` / `Turijobs-2021`
- [ ] Verificar redirección a dashboard
- [ ] Verificar que aparece nombre de usuario en header

### 1.2 Login desde Landing
- [ ] Abrir: https://landing-page-chi-one-12.vercel.app
- [ ] Click en "Iniciar Sesión"
- [ ] Verificar redirección a frontend login
- [ ] Login exitoso y redirección

### 1.3 Persistencia de Sesión
- [ ] Recargar página (F5)
- [ ] Verificar que sesión se mantiene
- [ ] Abrir nueva pestaña del frontend
- [ ] Verificar que está autenticado automáticamente

### 1.4 Logout
- [ ] Click en menú usuario → Cerrar sesión
- [ ] Verificar redirección a landing
- [ ] Intentar acceder dashboard sin login
- [ ] Verificar que redirige a login

**Estado:** ⏳ Pendiente

---

## 📊 **SECCIÓN 2: DASHBOARD**

### 2.1 Métricas Principales
- [ ] Verificar card "Campañas Activas" muestra número correcto
- [ ] Verificar card "Ofertas Activas" muestra número correcto
- [ ] Verificar card "Presupuesto Total" muestra valor correcto
- [ ] Verificar card "Aplicaciones Recibidas" (puede ser 0)

### 2.2 Gráficos de Distribución
- [ ] Budget Distribution Chart aparece
- [ ] Applications Distribution Chart aparece
- [ ] Datos corresponden a campañas reales del usuario

### 2.3 Performance
- [ ] Dashboard carga en < 3 segundos
- [ ] No hay errores en consola del navegador (F12)
- [ ] No hay warnings de red en Network tab

**Estado:** ⏳ Pendiente

---

## 🗂️ **SECCIÓN 3: CONEXIONES (DATA SOURCES)**

### 3.1 Listar Conexiones
- [ ] Navegar a /conexiones
- [ ] Verificar que aparece lista de conexiones del usuario
- [ ] Verificar contadores de ofertas por conexión

### 3.2 Ver Detalle de Conexión
- [ ] Click en una conexión existente
- [ ] Verificar que muestra información completa
- [ ] Verificar pestañas: Detalle / Mapeo / Ofertas

### 3.3 Crear Nueva Conexión (Opcional)
- [ ] Click "Nueva Conexión"
- [ ] Seleccionar tipo: API / XML Feed
- [ ] Configurar URL y credenciales de prueba
- [ ] Guardar y verificar que aparece en lista

### 3.4 Mapeo de Campos
- [ ] Abrir conexión existente → Pestaña Mapeo
- [ ] Verificar que muestra campos source y target
- [ ] Hacer cambio en mapeo (opcional)
- [ ] Guardar y verificar que persiste

**Estado:** ⏳ Pendiente

---

## 💼 **SECCIÓN 4: OFERTAS DE TRABAJO**

### 4.1 Listar Ofertas
- [ ] Navegar a /ofertas
- [ ] Verificar que carga lista de ofertas
- [ ] Verificar paginación funciona (siguiente/anterior)
- [ ] Verificar contador total de ofertas

### 4.2 Filtros de Búsqueda
- [ ] **Búsqueda textual:** Ingresar término (ej: "cocinero")
- [ ] Verificar que filtra resultados
- [ ] **Filtro Estado:** Cambiar a "Active" / "Archived"
- [ ] **Filtro Ubicación:** Seleccionar ciudad
- [ ] **Filtro Sector:** Seleccionar sector
- [ ] Verificar que filtros se mantienen en paginación

### 4.3 Performance de Ofertas
- [ ] Primera carga < 2 segundos
- [ ] Búsqueda con filtros < 1 segundo
- [ ] Navegación entre páginas < 500ms
- [ ] Sin errores de timeout

### 4.4 Detalle de Oferta (Opcional)
- [ ] Click en una oferta
- [ ] Verificar que muestra información completa
- [ ] Verificar campos: Título, Empresa, Descripción, etc.

**Estado:** ⏳ Pendiente

---

## 📂 **SECCIÓN 5: SEGMENTOS**

### 5.1 Listar Segmentos
- [ ] Navegar a /segmentos
- [ ] Verificar que muestra segmentos del usuario
- [ ] Verificar contador de ofertas por segmento

### 5.2 Crear Nuevo Segmento
- [ ] Click "Crear Segmento"
- [ ] Configurar filtros (ubicación, sector, etc.)
- [ ] Guardar segmento
- [ ] Verificar que aparece en lista con conteo correcto

### 5.3 Editar Segmento Existente
- [ ] Abrir segmento existente
- [ ] Modificar filtros
- [ ] Guardar cambios
- [ ] Verificar que conteo se actualiza

### 5.4 Eliminar Segmento (Opcional)
- [ ] Intentar eliminar segmento
- [ ] Verificar confirmación
- [ ] Confirmar eliminación
- [ ] Verificar que desaparece de lista

**Estado:** ⏳ Pendiente

---

## 🎯 **SECCIÓN 6: CAMPAÑAS**

### 6.1 Listar Campañas
- [ ] Navegar a /campanas
- [ ] Verificar lista de campañas del usuario
- [ ] Verificar estados: Activa / Pausada / Completada

### 6.2 Ver Detalle de Campaña
- [ ] Click en campaña existente
- [ ] Verificar información completa:
  - Nombre de campaña
  - Segmentos asociados
  - Canales de distribución
  - Presupuesto asignado
  - Estadísticas (impresiones, clicks, aplicaciones)

### 6.3 Crear Nueva Campaña
- [ ] Click "Nueva Campaña"
- [ ] Completar formulario:
  - Nombre de campaña
  - Seleccionar segmento(s)
  - Configurar presupuesto
  - Seleccionar canales (Jooble, Talent, etc.)
- [ ] Guardar campaña
- [ ] Verificar que aparece en lista

### 6.4 Distribuir Campaña
- [ ] Abrir campaña creada
- [ ] Click "Distribuir a Canales"
- [ ] Verificar que se envía a canales configurados
- [ ] Verificar logs/confirmaciones

**Estado:** ⏳ Pendiente

---

## 🔑 **SECCIÓN 7: CANALES DE DISTRIBUCIÓN**

### 7.1 Listar Canales Configurados
- [ ] Navegar a /credenciales (o /canales)
- [ ] Verificar lista de canales disponibles:
  - Jooble
  - Talent.com
  - JobRapido
  - WhatJobs
  - InfoJobs (placeholder)
  - LinkedIn (placeholder)
  - Indeed (placeholder)

### 7.2 Configurar Credenciales Jooble
- [ ] Abrir configuración Jooble
- [ ] Verificar que muestra campos:
  - País: ES / PT
  - API Key
- [ ] Editar credenciales (opcional)
- [ ] Guardar y verificar encriptación

### 7.3 Verificar Estado de Canales
- [ ] Verificar indicador de estado por canal:
  - ✅ Credenciales configuradas
  - ⏳ Sin credenciales
  - ❌ Error de conexión

**Estado:** ⏳ Pendiente

---

## 📈 **SECCIÓN 8: MÉTRICAS Y ANALYTICS**

### 8.1 Dashboard de Métricas
- [ ] Verificar sección de métricas en dashboard
- [ ] Verificar gráficos de performance por canal
- [ ] Verificar evolución de presupuesto
- [ ] Verificar tasa de conversión (aplicaciones/gasto)

### 8.2 Métricas por Campaña
- [ ] Abrir campaña activa
- [ ] Verificar métricas específicas:
  - Gasto acumulado
  - Aplicaciones recibidas
  - CPA (Costo Por Aplicación)
  - ROI

### 8.3 Exportar Datos (Opcional)
- [ ] Buscar opción de exportar métricas
- [ ] Descargar CSV/Excel
- [ ] Verificar que contiene datos correctos

**Estado:** ⏳ Pendiente

---

## 🔧 **SECCIÓN 9: CONFIGURACIÓN DE USUARIO**

### 9.1 Perfil de Usuario
- [ ] Navegar a /perfil o /configuracion
- [ ] Verificar información del usuario:
  - Email
  - Nombre
  - Rol (User / Admin)
- [ ] Editar información (opcional)

### 9.2 Límites y Restricciones
- [ ] Verificar límites configurados:
  - Presupuesto diario máximo
  - Presupuesto mensual máximo
  - Max CPA permitido

**Estado:** ⏳ Pendiente

---

## 🚨 **SECCIÓN 10: ERRORES Y EDGE CASES**

### 10.1 Manejo de Errores de Red
- [ ] Desactivar WiFi temporalmente
- [ ] Intentar acción en el frontend
- [ ] Verificar mensaje de error user-friendly
- [ ] Reactivar WiFi y verificar recuperación

### 10.2 Sesión Expirada
- [ ] Esperar timeout de sesión (30 min)
- [ ] O forzar logout desde otra pestaña
- [ ] Intentar acción en pestaña original
- [ ] Verificar redirección a login

### 10.3 Páginas 404
- [ ] Navegar a URL inexistente: /pagina-que-no-existe
- [ ] Verificar página 404 personalizada
- [ ] Verificar botón para volver al dashboard

### 10.4 Validación de Formularios
- [ ] Intentar crear campaña sin nombre
- [ ] Intentar guardar segmento sin filtros
- [ ] Verificar mensajes de validación claros

**Estado:** ⏳ Pendiente

---

## ✅ **RESUMEN DE TESTING**

### Status General
- [ ] Autenticación: ⏳ Pendiente
- [ ] Dashboard: ⏳ Pendiente
- [ ] Conexiones: ⏳ Pendiente
- [ ] Ofertas: ⏳ Pendiente
- [ ] Segmentos: ⏳ Pendiente
- [ ] Campañas: ⏳ Pendiente
- [ ] Canales: ⏳ Pendiente
- [ ] Métricas: ⏳ Pendiente
- [ ] Configuración: ⏳ Pendiente
- [ ] Errores: ⏳ Pendiente

### Bugs Encontrados
_(Listar aquí cualquier bug encontrado durante testing)_

1.

### Mejoras Sugeridas
_(Listar aquí sugerencias de mejora)_

1.

---

## 🎯 **PRÓXIMOS PASOS DESPUÉS DE TESTING**

1. **Documentar bugs críticos** y priorizarlos
2. **Crear issues en GitHub** para cada bug
3. **Planificar fixes** para próxima sesión
4. **Actualizar CLAUDE.md** con estado post-testing
5. **Preparar demo** para stakeholders (si aplica)

---

**Última actualización:** 2026-02-08
