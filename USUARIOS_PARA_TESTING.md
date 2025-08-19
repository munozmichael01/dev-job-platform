# 🔑 USUARIOS PARA TESTING - JOB PLATFORM

## 📋 **ESTADO ACTUAL DEL SISTEMA**
✅ **Sistema 100% funcional** - Flujo de login completamente reparado
✅ **Multi-tenancy implementado** - Cada usuario ve solo sus datos
✅ **Todos los servicios funcionando** - Backend, Frontend y Landing Page operativos

---

## 🎯 **ARQUITECTURA DE SERVICIOS**

| **Servicio** | **Puerto** | **Estado** | **URL** |
|--------------|------------|------------|---------|
| **Landing Page** | 3000 | ✅ Running | http://localhost:3000/login |
| **Backend API** | 3002 | ✅ Running | http://localhost:3002 |
| **Platform Dashboard** | 3006 | ✅ Running | http://localhost:3006 |

---

## 👥 **USUARIOS DISPONIBLES PARA LOGIN**

### **1. 👑 USUARIO PROPIETARIO (Dueño de todos los datos)**
```
Email: juan@miempresa.com
Password: password123
UserID: 1
Role: superadmin
Datos visibles: ✅ LAS 9 CAMPAÑAS EXISTENTES (propietario)
```
**📊 Lo que verá:** Todas las campañas, segmentos, ofertas y conexiones del sistema porque es el dueño original de todos los datos.

### **2. 🔐 SUPER ADMINISTRADOR GLOBAL**
```
Email: superadmin@jobplatform.com  
Password: admin123
UserID: 8
Role: superadmin
Datos visibles: ✅ TODOS LOS DATOS DE TODOS LOS USUARIOS
```
**🌍 Lo que verá:** Puede ver y gestionar datos de cualquier usuario en el sistema (rol de administrador global).

### **3. 👤 USUARIO REGULAR (Sin datos propios)**
```
Email: michael.munoz@turijobs.com
Password: Turijobs-2021
UserID: 11
Role: user
Datos visibles: ❌ VACÍO (no tiene datos asignados)
```
**🔒 Lo que verá:** Pantallas vacías porque no tiene campañas, ofertas ni segmentos asignados (perfecto para probar multi-tenancy).

---

## 🧪 **INSTRUCCIONES DE TESTING**

### **💻 PRUEBA DESDE NAVEGADOR (Flujo completo):**
1. Ir a: http://localhost:3000/login
2. Usar cualquiera de los usuarios de arriba
3. ✅ Debe redireccionar automáticamente a http://localhost:3006 (dashboard)
4. ✅ Debe mostrar solo los datos del usuario logueado

### **🛠️ PRUEBA DESDE API (Directa):**
```bash
# Test login directo
curl -X POST "http://localhost:3002/api/auth/login" \
     -H "Content-Type: application/json" \
     -d '{"email": "juan@miempresa.com", "password": "password123"}'

# Test acceso a datos protegidos (usar el token de arriba)
curl -X GET "http://localhost:3002/api/campaigns" \
     -H "Authorization: Bearer TOKEN_AQUÍ"
```

---

## 🔍 **VERIFICACIÓN DE MULTI-TENANCY**

### **✅ Comportamiento Esperado:**

| **Usuario** | **Campañas que ve** | **Razón** |
|-------------|---------------------|-----------|
| `juan@miempresa.com` | 9 campañas | Es propietario (UserId=1) |
| `superadmin@jobplatform.com` | 9 campañas | Rol superadmin (ve todo) |
| `michael.munoz@turijobs.com` | 0 campañas | No tiene datos asignados |

### **🚨 Indicadores de Problema:**
- ❌ Si un usuario regular ve datos de otros = **FALLA DE SEGURIDAD**
- ❌ Si la redirección no funciona = **FALLA DE INTEGRACIÓN**
- ❌ Si el login falla = **FALLA DE AUTENTICACIÓN**

---

## 🏗️ **CÓMO FUNCIONA EL FLUJO**

1. **Login en Landing Page** (puerto 3000)
   - Usuario ingresa credenciales
   - Landing page llama a backend (puerto 3002)
   - Backend valida y genera JWT token

2. **Redirección al Dashboard** (puerto 3006)
   - Landing page guarda token en localStorage
   - Redirecciona a `window.location.assign(http://localhost:3006)`
   - Platform frontend lee token de localStorage

3. **Autenticación en Platform**
   - AuthContext verifica token válido
   - ProtectedRoute permite acceso
   - Todas las APIs usan JWT para filtrar datos por UserId

---

## 📝 **USUARIOS ADICIONALES EN BASE DE DATOS**

Hay 14 usuarios totales en la base de datos, pero los 3 de arriba son los únicos con contraseñas conocidas y configurados para testing. Los otros usuarios fueron creados durante pruebas de desarrollo.

---

## 🎉 **RESUMEN DE ESTADO**

**✅ COMPLETAMENTE FUNCIONAL:**
- Sistema de autenticación JWT
- Multi-tenancy (separación de datos por usuario)
- Flujo landing page → backend → dashboard
- Roles de usuario (user, admin, superadmin)
- APIs protegidas con filtrado automático

**🚀 LISTO PARA PRODUCCIÓN:**
El sistema está preparado para usuarios reales. Solo necesita:
- Configurar credenciales de canales reales (Jooble, Talent.com, etc.)
- Configurar SMTP para notificaciones por email
- Deployment en servidores de producción

---

*Última actualización: 2025-08-18 - Sistema de login completamente funcional*