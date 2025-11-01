# 📋 Tareas Pendientes - Job Platform

**Fecha de creación:** 2025-11-02  
**Última actualización:** 2025-11-02  
**Estado general:** 🔄 En progreso

---

## 🔴 **ALTA PRIORIDAD**

### 1. ✅ Implementar Sistema de Refresh Tokens

**Fecha de creación:** 2025-11-02  
**Estado:** ⏳ Pendiente  
**Prioridad:** 🔴 Alta  
**Impacto:** Seguridad, UX, Gestión de sesiones

#### **Descripción:**
Reemplazar el sistema actual de JWT simple (24h) por un sistema de Access Tokens + Refresh Tokens para mejorar seguridad, UX y gestión de sesiones.

#### **Problema Actual:**
- ❌ No se pueden revocar tokens (si se roba un token, es válido por 24 horas)
- ❌ Sesiones expiran abruptamente (pérdida de trabajo en progreso)
- ❌ No hay gestión de sesiones por dispositivo
- ❌ Logout no es efectivo (token sigue válido hasta expirar)
- ❌ No hay tracking de sesiones activas

#### **Objetivos:**
1. Implementar Access Tokens (15 minutos de vida)
2. Implementar Refresh Tokens (7-30 días, almacenados en BD)
3. Sistema de revocación de tokens en logout
4. Refresco automático de tokens en frontend
5. Gestión de múltiples dispositivos/sesiones
6. Tracking de sesiones activas

#### **Tareas Técnicas:**

**Backend:**
- [ ] Crear tabla `RefreshTokens` en SQL Server
- [ ] Modificar endpoint `/api/auth/login` para generar ambos tokens
- [ ] Crear endpoint `/api/auth/refresh` que valide refresh token desde BD
- [ ] Modificar endpoint `/api/auth/logout` para revocar refresh token
- [ ] Actualizar middleware de autenticación para validar access tokens cortos
- [ ] Agregar endpoint `/api/auth/sessions` para listar sesiones activas
- [ ] Agregar endpoint `/api/auth/sessions/:id/revoke` para revocar sesión específica
- [ ] Actualizar documentación Swagger

**Frontend:**
- [ ] Implementar refresco automático de access token antes de expirar
- [ ] Implementar interceptor para refresh automático en `useAuthFetch`
- [ ] Actualizar `AuthContext` para manejar access token y refresh token
- [ ] Agregar UI para "Dispositivos activos" en perfil de usuario
- [ ] Agregar funcionalidad para revocar sesiones individuales
- [ ] Manejar errores de refresh token expirado (redirigir a login)

**Base de Datos:**
- [ ] Script SQL para crear tabla `RefreshTokens`
- [ ] Índices para performance (`UserId`, `Token`, `ExpiresAt`)
- [ ] Script de migración para usuarios existentes (opcional)

#### **Dependencias:**
- Ninguna

#### **Estimación:**
- **Tiempo:** 3-5 días de desarrollo
- **Complejidad:** Media-Alta
- **Testing:** 2 días adicionales

#### **Criterios de Aceptación:**
- ✅ Access tokens expiran en 15 minutos
- ✅ Refresh tokens almacenados en BD con expiración 7-30 días
- ✅ Logout revoca refresh token en BD
- ✅ Frontend refresca access token automáticamente
- ✅ Usuario puede ver y revocar sesiones activas
- ✅ Tokens robados expiran en máximo 15 minutos (vs 24h actual)
- ✅ Múltiples dispositivos pueden tener sesiones independientes

#### **Documentación Relacionada:**
- `IMPACTO_JWT_REFRESH.md` - Análisis detallado del problema
- `COMPARACION_DOCUMENTACION_CODIGO.md` - Contexto del sistema actual

### 2. ✅ Implementar Autenticación Google OAuth Completa

**Fecha de creación:** 2025-11-02  
**Estado:** ⏳ Pendiente  
**Prioridad:** 🔴 Alta  
**Impacto:** UX, Conversión, Seguridad

#### **Descripción:**
Implementar el flujo completo de autenticación con Google OAuth en el frontend, ya que actualmente el backend está preparado para recibir datos pero no hay integración en el frontend ni generación de tokens JWT.

#### **Problema Actual:**
- ❌ No hay botón de "Iniciar sesión con Google" en la página de login
- ❌ No hay integración con Google OAuth SDK en el frontend
- ❌ El endpoint `/api/auth/google` existe pero no genera token JWT (solo devuelve datos de usuario)
- ❌ Usuarios deben crear cuenta manualmente aunque quieran usar Google
- ❌ Flujo OAuth no estándar - backend espera datos del frontend pero no hay SDK implementado
- ❌ No hay configuración de Google Cloud Console para OAuth

#### **Objetivos:**
1. Configurar Google OAuth en Google Cloud Console
2. Instalar e integrar Google OAuth SDK en frontend
3. Implementar botón de "Iniciar sesión con Google" en login
4. Manejar callback de Google OAuth correctamente
5. Modificar backend para generar token JWT en autenticación Google
6. Integrar con AuthContext para mantener sesión
7. Manejar casos edge (usuario existente con email diferente, etc.)

#### **Tareas Técnicas:**

**Google Cloud Console:**
- [ ] Crear proyecto en Google Cloud Console (si no existe)
- [ ] Habilitar Google+ API / Google Identity Services
- [ ] Crear credenciales OAuth 2.0 (Client ID y Client Secret)
- [ ] Configurar URI de redirección autorizados:
  - `http://localhost:3006/auth/google/callback` (desarrollo)
  - `https://platform.tudominio.com/auth/google/callback` (producción)
- [ ] Obtener Client ID para frontend

**Frontend:**
- [ ] Instalar `@react-oauth/google` o `google-auth-library`
- [ ] Configurar Google OAuth Provider en `layout.tsx` o `AuthProvider`
- [ ] Agregar variable de entorno `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- [ ] Crear componente `GoogleSignInButton` reutilizable
- [ ] Integrar botón en `app/login/page.tsx`
- [ ] Implementar función `handleGoogleSignIn` que:
  - Inicia flujo OAuth con Google
  - Obtiene credenciales del usuario (email, name, picture, sub/googleId)
  - Llama a `/api/auth/google` con los datos
  - Recibe token JWT del backend
  - Llama a `login()` del AuthContext con usuario y token
  - Redirige al dashboard
- [ ] Manejar errores de OAuth (usuario cancela, error de red, etc.)
- [ ] Agregar loading state durante autenticación Google
- [ ] Manejar caso de usuario que ya existe con email/password (opcional: vincular cuentas)

**Backend:**
- [ ] Modificar endpoint `/api/auth/google` para generar token JWT después de crear/actualizar usuario
- [ ] Agregar validación de `googleId` (ID token de Google) para seguridad
- [ ] Retornar token JWT en respuesta (igual que `/api/auth/login`)
- [ ] Validar que el email de Google coincida con email en BD (si usuario existe)
- [ ] Actualizar documentación Swagger con nuevo formato de respuesta
- [ ] Agregar logging para auditoría de autenticaciones Google

**Seguridad:**
- [ ] Validar ID token de Google en backend (opcional pero recomendado para producción)
- [ ] Verificar que `googleId` no esté asociado a otro usuario
- [ ] Manejar caso de email cambiado en Google Account
- [ ] Implementar rate limiting en endpoint `/api/auth/google`

**Testing:**
- [ ] Probar flujo completo de login con Google
- [ ] Probar registro nuevo usuario con Google
- [ ] Probar login usuario existente con Google
- [ ] Probar error cuando usuario cancela OAuth
- [ ] Probar error de red durante OAuth
- [ ] Probar caso edge: usuario existe con email diferente

#### **Dependencias:**
- Tarea 1 (Refresh Tokens): No es crítica, pero ideal tenerla antes para que Google OAuth también use refresh tokens

#### **Estimación:**
- **Tiempo:** 2-3 días de desarrollo
- **Complejidad:** Media
- **Testing:** 1 día adicional

#### **Código de Referencia Actual:**

**Backend (necesita modificación):**
```javascript
// backend/src/routes/auth.js línea 20-110
router.post('/google', async (req, res) => {
  const { email, name, image, googleId } = req.body;
  // ... crea/actualiza usuario ...
  // ❌ PROBLEMA: No genera token JWT
  res.json({ success: true, user: {...}, isNewUser: true });
});
```

**Frontend (no existe):**
```typescript
// ⚠️ NO EXISTE - Necesita implementación completa
// Debe: Instalar SDK, crear botón, manejar callback, llamar backend
```

#### **Criterios de Aceptación:**
- ✅ Botón "Iniciar sesión con Google" visible en página de login
- ✅ Flujo OAuth funciona correctamente (redirect a Google → callback → backend → dashboard)
- ✅ Backend genera token JWT después de autenticación Google
- ✅ Usuario nuevo se registra automáticamente con datos de Google
- ✅ Usuario existente se autentica correctamente
- ✅ Sesión persiste usando AuthContext (igual que login email/password)
- ✅ Errores de OAuth se manejan gracefully (usuario cancela, errores de red)
- ✅ Variables de entorno configuradas (desarrollo y producción)
- ✅ Google Cloud Console configurado con redirect URIs correctos

#### **Impacto en Negocio:**
- ✅ **Mejor UX:** Login más rápido y sin contraseña
- ✅ **Mayor conversión:** Reducción de fricción en registro
- ✅ **Seguridad:** Autenticación confiable de Google
- ✅ **Menos soporte:** Menos "olvidé mi contraseña"

#### **Documentación Relacionada:**
- `COMPARACION_DOCUMENTACION_CODIGO.md` - Discrepancia identificada
- `AUTHENTICATION_FLOW_DOCUMENTATION.md` - Arquitectura actual

---

## 🟡 **MEDIA PRIORIDAD**

*(Tareas pendientes de definir)*

---

## 🟢 **BAJA PRIORIDAD**

*(Tareas pendientes de definir)*

---

## 📝 **NOTAS**

- Este documento se actualizará a medida que se identifiquen nuevas tareas pendientes
- Las tareas se priorizarán según impacto en seguridad, UX y negocio
- Se agregarán estimaciones de tiempo y criterios de aceptación para cada tarea

---

## 📊 **RESUMEN**

| Prioridad | Total | Pendientes | En Progreso | Completadas |
|-----------|-------|------------|-------------|-------------|
| 🔴 Alta | 2 | 2 | 0 | 0 |
| 🟡 Media | 0 | 0 | 0 | 0 |
| 🟢 Baja | 0 | 0 | 0 | 0 |
| **TOTAL** | **2** | **2** | **0** | **0** |

---

**Próximos pasos:** Continuar analizando otros puntos pendientes del proyecto.

