# Claude Code - Job Platform Project Context

## 📋 Estado del Proyecto (Última sesión: 2025-08-11)

### ✅ Problemas Resueltos Recientemente

#### 1. **Paginación Corregida**
- **Problema**: Paginación keyset no funcionaba en página de ofertas tras cambios de estados
- **Causa**: Hook `useKeysetPagination` configurado para scroll infinito pero usado para paginación tradicional + Error SQL Server `FETCH NEXT` sin `OFFSET`
- **Solución**: 
  - Frontend: Corregido hook para navegación anterior/siguiente tradicional
  - Backend: Agregado `OFFSET 0 ROWS` antes de `FETCH NEXT @limit ROWS ONLY` en línea 741 de `backend/index.js`
- ✅ **Funcionando**: Navegación de páginas con botones "Anterior" y "Siguiente"

#### 2. **Control de Estados Unificado y Automático**
- **Problema**: Estados inconsistentes entre processors y sin lógica automática por presupuesto/objetivos
- **Solución Implementada**:
  - **Estados uniformes**: Todos los processors respetan decisiones manuales del usuario
  - **Lógica automática**: Integrado `src/utils/statusUpdater.js` en todos los processors
  - **StatusId corregidos**: Alineados con esquema oficial

### 🎯 **Esquema de Estados Oficial**

| **StatusId** | **Code** | **Descripción** | **Control** |
|-------------|----------|----------------|-------------|
| **1** | `active` | Oferta activa | ✅ Automático + Manual |
| **2** | `paused` | Pausada manualmente | ✅ Solo Manual (respetado) |
| **3** | `completed_goal` | Objetivo completado | ✅ Automático |
| **4** | `completed_budget` | Presupuesto completado | ✅ Automático |
| **5** | `archived` | Archivada | ✅ Automático + Manual |

### 🔄 **Flujo Automático de Estados**

| **Evento** | **Acción** | **StatusId Resultante** |
|------------|------------|------------------------|
| **Nueva oferta** | Insertar desde feed | **1** (`active`) |
| **Objetivo alcanzado** | `ApplicationsReceived >= ApplicationsGoal` | **3** (`completed_goal`) |
| **Presupuesto agotado** | `BudgetSpent >= Budget` | **4** (`completed_budget`) |
| **Oferta no recibida** | Ausente en feed/archivo | **5** (`archived`) |
| **Pausada manualmente** | Usuario pausa | **2** (`paused`) - **RESPETADO** |

### 🚀 Funcionalidades Funcionando

#### **Sistema de Paginación**
- ✅ **Keyset Pagination**: Performance <300ms constante
- ✅ **Navegación**: Botones "Anterior" y "Siguiente"
- ✅ **API**: Backend soporta cursor-based pagination
- ✅ **Frontend**: Hook optimizado para páginas tradicionales

#### **Sistema de Segmentos**
- ✅ **CRUD Completo**: Crear, leer, actualizar y eliminar segmentos
- ✅ **Filtros Dinámicos**: Por ubicación, sector, empresa, título de trabajo
- ✅ **Vista en Tiempo Real**: Lista todos los segmentos de la BBDD
- ✅ **Estimación**: Preview de ofertas que coinciden con filtros
- ✅ **Recalcular**: Actualizar conteo de ofertas de un segmento
- ✅ **Duplicar**: Crear copia de segmento existente
- ✅ **Estado de Campañas**: Indica si tiene campañas activas

#### **Control de Estados Inteligente**
- ✅ **4 Processors**: xmlProcessor, csvProcessor, apiProcessor, xmlFileProcessor
- ✅ **Lógica Uniforme**: Todos respetan estados manuales y aplican automáticos
- ✅ **Automático**: Estados por presupuesto y objetivos alcanzados
- ✅ **Manual**: Pausas y archivados manuales respetados

#### **XML Feed Processing**
- ✅ **Endpoint**: `POST /api/connections/:id/import`
- ✅ **Procesamiento**: Ofertas procesadas con control de estados
- ✅ **Auto-mapping**: Generación automática de field mappings
- ✅ **Error Handling**: ClientId NULL corregido

#### **Configuración de Desarrollo**
- ✅ **Backend**: `http://localhost:3002`
- ✅ **Frontend**: `http://localhost:3006` 
- ✅ **CORS**: Configurado correctamente
- ✅ **Logs**: Sistema de logging implementado

## 🔧 Comandos de Inicio

### Backend
```bash
cd backend
node index.js
# Debe mostrar: 🚀 🚀 🚀 CLAUDE DEBUG: NEW VERSION WITH DEBUG LOGS LOADED! 🚀 🚀 🚀
```

### Frontend
```bash
cd frontend
npm run dev
# Debe levantar en: http://localhost:3006
```

## 🧪 Estado de Testing

### ✅ **Completados**
- [x] Paginación keyset funcional con navegación anterior/siguiente
- [x] Control de estados automático integrado en todos los processors
- [x] StatusId alineados con esquema oficial
- [x] XML Feed con ClientId corregido
- [x] API de ofertas con filtros y paginación
- [x] **Sistema de Segmentos CRUD**: Crear, editar, eliminar y listar
- [x] **Filtros de segmentos**: Ubicación, sector, empresa, título
- [x] **Estimación en tiempo real**: Preview de ofertas coincidentes
- [x] **Operaciones avanzadas**: Recalcular y duplicar segmentos

### 🔄 **Pendientes**
- [ ] Probar estados automáticos en producción (presupuesto/objetivos)
- [ ] Validar CSV y API processors con nuevos estados
- [ ] Testing de edge cases con múltiples feeds consecutivos
- [ ] Optimización de logging (rotación de archivos)

## 📁 Archivos Clave Modificados (Esta Sesión)

```
backend/
├── index.js (línea 741: OFFSET 0 ROWS agregado para keyset pagination)
├── src/utils/statusUpdater.js (NUEVO: lógica automática de estados)
├── src/routes/segments.js (API completa para segmentos)
├── src/processors/xmlProcessor.js 
│   ├── StatusId = 5 para archived
│   ├── Lógica MERGE respeta estados manuales
│   └── Integración updateOfferStatusByGoals()
├── src/processors/csvProcessor.js (mismo patrón)
├── src/processors/apiProcessor.js (mismo patrón)
└── src/processors/xmlFileProcessor.js (mismo patrón)

frontend/
├── hooks/use-keyset-pagination.ts
│   ├── Lógica loadPrevious corregida
│   ├── canGoPrevious basado en página actual
│   └── Historia de cursors mejorada
├── app/ofertas/page.tsx (paginación funcional)
├── app/segmentos/page.tsx (lista y gestión de segmentos)
├── app/segmentos/nuevo/page.tsx (crear segmento)
├── app/segmentos/[id]/editar/page.tsx (editar segmento)
└── components/ui/multi-select.tsx (componente para filtros múltiples)
```

## 💡 Arquitectura de Estados

### **Lógica MERGE en Processors**
```sql
StatusId = CASE 
  WHEN Target.StatusId = 2 THEN 2  -- Mantener pausadas manuales
  WHEN Target.StatusId = 5 THEN 5  -- Mantener archivadas manuales
  WHEN Target.StatusId = 3 THEN 3  -- Mantener objetivos completados
  WHEN Target.StatusId = 4 THEN 4  -- Mantener presupuestos completados
  ELSE @StatusId  -- Actualizar activas (1)
END
```

### **Lógica de Archivado Automático**
```sql
UPDATE JobOffers
SET StatusId = 5  -- ARCHIVADA
WHERE ConnectionId = @ConnectionId
AND StatusId NOT IN (2, 3, 4)  -- Respetar estados completados/pausados
AND ExternalId NOT IN (ofertas_actuales)
```

### **Actualización Automática por Métricas**
```sql
-- Objetivo completado
UPDATE JobOffers SET StatusId = 3 
WHERE ApplicationsReceived >= ApplicationsGoal AND StatusId = 1

-- Presupuesto completado  
UPDATE JobOffers SET StatusId = 4
WHERE BudgetSpent >= Budget AND StatusId = 1
```

### **Sistema de Segmentos**

#### **API Endpoints**
```
GET    /api/segments           - Listar todos los segmentos
POST   /api/segments           - Crear nuevo segmento  
GET    /api/segments/:id       - Obtener segmento específico
PUT    /api/segments/:id       - Actualizar segmento
DELETE /api/segments/:id       - Eliminar segmento
GET    /api/segments/:id/estimate - Contar ofertas del segmento
POST   /api/segments/estimate-preview - Preview sin guardar
POST   /api/segments/:id/recalculate - Recalcular conteo
POST   /api/segments/:id/duplicate - Duplicar segmento
```

#### **Estructura de Filtros**
```json
{
  "jobTitles": ["Developer", "Engineer"],
  "locations": ["Madrid", "Barcelona"],
  "sectors": ["Tecnología", "Finanzas"],
  "companies": ["Google", "Microsoft"],
  "experienceLevels": ["Senior", "Junior"],
  "contractTypes": ["Indefinido", "Temporal"]
}
```

#### **Lógica de Filtrado**
- **Ubicaciones**: Busca en `City`, `Region`, y concatenación `City + Region`
- **Sectores**: Coincidencia exacta y parcial en campo `Sector`
- **Empresas**: Búsqueda en `CompanyName`  
- **Títulos**: Búsqueda en `Title` y `CompanyName`
- **Solo ofertas activas**: `StatusId = 1`
- **Límite de rendimiento**: Max 5 valores por filtro

## 🎯 Próximos Pasos Sugeridos

1. **Probar estados automáticos** con datos reales de presupuesto/objetivos
2. **Integrar segmentos con campañas** para targeting de ofertas
3. **Optimizar filtros de segmentos** con índices de base de datos
4. **Dashboard de métricas** mostrando distribución de estados por conexión
5. **Sistema de notificaciones** para estados completado_goal/completed_budget
6. **Tests unitarios** para sistema de estados y segmentos
7. **Documentación API** completa con ejemplos

## 🚨 Consideraciones Importantes

### **Estados Críticos**
- **StatusId = 2 (paused)**: NUNCA sobreescribir automáticamente
- **StatusId = 3/4 (completed)**: Solo automático, usuario puede reactivar manualmente
- **StatusId = 5 (archived)**: Automático por ausencia en feed, usuario puede reactivar

### **Performance**
- **Keyset pagination**: Mantiene <300ms independiente del volumen
- **Estados batch**: Se actualizan por lotes para eficiencia
- **Segmentos**: Filtros optimizados con límite de 5 valores por tipo
- **Indexes recomendados**: 
  - `(StatusId, ConnectionId, CreatedAt, Id)` para paginación
  - `(StatusId, City, Region, Sector, CompanyName)` para segmentos
  - `(Title, CompanyName)` para búsquedas de texto

### **Debugging**
- **Logs específicos**: `🎯 Estados automáticos actualizados: X objetivos, Y presupuestos`
- **Debug prefix**: `🚀 CLAUDE DEBUG:` para logs de desarrollo
- **Estado tracking**: Logs cuando cambios de estado ocurren

---
*Última actualización: 2025-08-11 - Sistema de Estados Automático y Paginación Corregida*