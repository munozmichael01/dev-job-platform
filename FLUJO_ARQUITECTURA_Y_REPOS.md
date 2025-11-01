# 🔄 Flujo de Arquitectura y Repositorios - Job Platform

**Última actualización:** 2025-11-02

---

## 🏗️ **ARQUITECTURA GENERAL**

### **Tres Aplicaciones Independientes:**

```
┌─────────────────────┐     ┌─────────────────────┐     ┌─────────────────────┐
│   LANDING PAGE      │     │  PLATFORM DASHBOARD │     │    BACKEND API      │
│   (Puerto 3000)     │     │    (Puerto 3006)    │     │   (Puerto 3002)     │
│                     │     │                     │     │                     │
│ • Marketing         │────▶│ • Dashboard         │◀────│ • Autenticación     │
│ • Registro          │     │ • Gestión Campañas  │     │ • Base de Datos     │
│ • Login inicial     │     │ • Analytics         │     │ • Lógica Negocio    │
│                     │     │ • Configuraciones   │     │ • APIs Externas     │
└─────────────────────┘     └─────────────────────┘     └─────────────────────┘
      Next.js                       Next.js                   Node.js/Express
```

---

## 📦 **REPOSITORIOS DE GITHUB**

### **Repositorio 1: Landing Page** 
**Ubicación Local:** `C:\Dev\landing-page`

**GitHub:** ✅ https://github.com/munozmichael01/landing-page
- **Branch:** `master`
- **Último commit en GitHub:** 2025-08-22
- ⚠️ **Estado:** Tiene cambios locales sin commit (correcciones de signin)

**Características:**
- Next.js 15 + TypeScript
- Marketing y registro de usuarios
- Página de login que redirige al Platform Dashboard
- Variables de entorno: `NEXT_PUBLIC_FRONTEND_URL`, `NEXT_PUBLIC_API_URL`

**Deploy:** Probablemente Vercel

---

### **Repositorio 2: Platform Dashboard (Frontend)**
**Ubicación Local:** `C:\Dev\job-platform\frontend`

**GitHub:** ✅ https://github.com/munozmichael01/dev-job-platform (monorepo)
- **Branch:** `main`
- **Último commit:** 2025-11-02 (documentación)
- **Estado:** ✅ Actualizado

**Características:**
- Next.js 15 + TypeScript + React 19
- Aplicación principal para gestión
- Dashboard, Campañas, Ofertas, Segmentos, Métricas
- Variables de entorno: `NEXT_PUBLIC_API_URL`

**Deploy:** Probablemente Vercel

---

### **Repositorio 3: Backend API**
**Ubicación Local:** `C:\Dev\job-platform\backend`

**GitHub:** ✅ https://github.com/munozmichael01/dev-job-platform (monorepo)
- **Branch:** `main`
- **Último commit:** 2025-11-02 (documentación)
- **Estado:** ✅ Actualizado
- **Nota:** Frontend y Backend están en el mismo repositorio (monorepo)

**Características:**
- Node.js + Express
- SQL Server como BD principal
- API REST documentada con Swagger
- Integraciones con canales externos (Jooble, Talent.com, etc.)

**Deploy:** Probablemente Railway, Render, o servidor propio

---

## 🔄 **FLUJO COMPLETO DE USUARIO**

### **1. Flujo de Registro (Nuevo Usuario)**

```
Usuario → Landing Page (3000)
    ↓
Click "Empezar Ahora" o "Iniciar Sesión"
    ↓
Redirige a → Platform Dashboard Login (3006)
    ↓
Usuario completa formulario de registro
    ↓
Platform Frontend → POST /api/auth/register → Backend API (3002)
    ↓
Backend crea usuario en BD + genera Client automático
    ↓
Backend → Genera JWT Token → Frontend
    ↓
Frontend guarda token en localStorage
    ↓
Usuario redirigido a → Dashboard (/)
```

**Código Clave:**
- `frontend/app/login/page.tsx` - Formulario de login/registro
- `backend/src/routes/auth.js` - Endpoint `/api/auth/register`

---

### **2. Flujo de Login (Usuario Existente)**

#### **Opción A: Desde Landing Page**

```
Usuario → Landing Page (3000)
    ↓
Click "Iniciar Sesión"
    ↓
Redirige a → Platform Dashboard Login (3006)
    ↓
Usuario ingresa email/password
    ↓
Platform Frontend → POST /api/auth/login → Backend API (3002)
    ↓
Backend valida credenciales en BD
    ↓
Backend → Genera JWT Token → Frontend
    ↓
Frontend guarda token y redirige a Dashboard
```

**Código Clave:**
- `landing-page/src/components/layout/Header.tsx` - Botones que redirigen
- `frontend/app/login/page.tsx` - Formulario de login

#### **Opción B: Directo en Platform**

```
Usuario → Platform Dashboard (3006)
    ↓
Intenta acceder sin autenticación
    ↓
ProtectedRoute detecta → Redirige a /login
    ↓
Usuario completa login
    ↓
Flujo continúa igual que Opción A
```

---

### **3. Flujo de Navegación Autenticada**

```
Usuario autenticado → Platform Dashboard (3006)
    ↓
Navega a cualquier sección (Campañas, Ofertas, etc.)
    ↓
Cada request incluye: Authorization: Bearer {JWT_TOKEN}
    ↓
Backend valida token en cada request
    ↓
Backend procesa y retorna datos
    ↓
Frontend muestra datos
```

**Componentes Clave:**
- `frontend/contexts/AuthContext.tsx` - Maneja estado de autenticación
- `frontend/components/ProtectedRoute.tsx` - Protege rutas
- `backend/src/middleware/authMiddleware.js` - Valida JWT

---

## 🔗 **CONEXIONES ENTRE APLICACIONES**

### **Landing → Platform Dashboard**
- **Método:** Redirect con `window.location.href`
- **URL:** Variable `NEXT_PUBLIC_FRONTEND_URL` o `http://localhost:3006`
- **Ubicación:** `landing-page/src/components/layout/Header.tsx`

### **Platform Dashboard → Backend API**
- **Método:** Fetch API con JWT en headers
- **URL:** Variable `NEXT_PUBLIC_API_URL` o `http://localhost:3002`
- **Ubicación:** `frontend/lib/api.ts` y `frontend/hooks/useAuthFetch.ts`

### **Landing → Backend API (solo para registro)**
- **Método:** Fetch API
- **URL:** Variable `NEXT_PUBLIC_API_URL`
- **Ubicación:** `landing-page/src/app/signup/page.tsx`

---

## 🌐 **VARIABLES DE ENTORNO**

### **Landing Page (.env.local)**

```env
# URL del Platform Dashboard
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3006
# En producción: https://platform.tudominio.com

# URL del Backend API
NEXT_PUBLIC_API_URL=http://localhost:3002
# En producción: https://api.tudominio.com
```

### **Platform Dashboard (.env.local)**

```env
# URL del Backend API
NEXT_PUBLIC_API_URL=http://localhost:3002
# En producción: https://api.tudominio.com

# URL de la Landing (para redirects)
NEXT_PUBLIC_LANDING_URL=http://localhost:3000
# En producción: https://tudominio.com
```

### **Backend API (.env)**

```env
# Base de Datos
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=JobPlatform
DB_USER=sa
DB_PASSWORD=tu_password

# JWT
JWT_SECRET=tu-jwt-secret-super-seguro
JWT_EXPIRES_IN=24h

# CORS
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3006

# Puerto
PORT=3002
```

---

## 🚀 **DEPLOYMENT Y VERIFICACIÓN DE VERSIONES**

### **Cómo Verificar si Estás Viendo la Última Versión en Vercel:**

#### **1. Verificar Commits en GitHub**

Para cada repositorio:

```bash
# Ver últimos commits
git log --oneline -10

# Ver fecha del último commit
git log -1 --format="%H %an %ad %s" --date=short

# Verificar si hay cambios no pusheados
git status
```

#### **2. Verificar Deploy en Vercel**

1. **Acceder a Vercel Dashboard:**
   - Ir a https://vercel.com/dashboard
   - Seleccionar proyecto correspondiente

2. **Verificar Último Deploy:**
   - Revisar fecha/hora del último deploy
   - Comparar con último commit en GitHub
   - Verificar que el deploy incluye el último commit

3. **Ver Logs de Deploy:**
   - Click en el último deploy
   - Ver logs para confirmar que se desplegó correctamente
   - Verificar que no hay errores

#### **3. Verificar en el Navegador**

**Desarrollo:**
```javascript
// En consola del navegador (F12)
console.log('Build Time:', document.querySelector('meta[name="build-time"]'));
```

**Producción:**
- Verificar fecha del último cambio en el código
- Comparar con lo que ves en producción
- Revisar Network tab para ver versiones de archivos JS/CSS

#### **4. Comandos Útiles para Verificar Versiones**

```bash
# Ver versión en package.json
cat package.json | grep version

# Ver último commit
git log -1

# Ver si hay cambios sin commit
git diff

# Ver si hay cambios sin push
git log origin/main..HEAD

# Ver última actualización de archivo específico
git log -1 --format="%ai" -- [ruta/archivo]
```

---

## 📋 **CHECKLIST PARA VERIFICAR QUE ESTÁS VIENDO LA ÚLTIMA VERSión**

### **Antes de Trabajar:**

- [ ] `git pull` en todos los repositorios
- [ ] Verificar que no hay cambios sin commit
- [ ] Revisar fecha del último commit vs lo que ves en producción

### **Para Verificar en Vercel:**

- [ ] Acceder a Vercel Dashboard
- [ ] Revisar fecha del último deploy
- [ ] Verificar que el commit SHA coincide con GitHub
- [ ] Revisar logs del deploy (sin errores)

### **Scripts de Verificación Rápida:**

```powershell
# Landing Page
cd C:\Dev\landing-page
.\verificar-version.ps1

# Platform (Frontend + Backend)
cd C:\Dev\job-platform
.\verificar-version.ps1
```

### **Para Verificar en Código Local:**

```powershell
# Landing Page
cd C:\Dev\landing-page
git log -1 --format="%H | %an | %ad | %s" --date=iso
git status

# Platform Frontend
cd C:\Dev\job-platform\frontend
git log -1 --format="%H | %ad | %s" --date=iso

# Platform Backend
cd C:\Dev\job-platform\backend
git log -1 --format="%H | %ad | %s" --date=iso
```

**Ver documentación completa:** `GUIA_VERIFICACION_VERSIONES.md`

---

## 🔧 **PUERTOS Y URLS**

### **Desarrollo Local:**

| Aplicación | Puerto | URL |
|------------|--------|-----|
| Landing Page | 3000 | `http://localhost:3000` |
| Platform Dashboard | 3006 (dev), 3001 (prod) | `http://localhost:3006` |
| Backend API | 3002 | `http://localhost:3002` |

### **Producción (Vercel/Cloud):**

| Aplicación | URL Ejemplo |
|------------|-------------|
| Landing Page | `https://tudominio.com` |
| Platform Dashboard | `https://platform.tudominio.com` |
| Backend API | `https://api.tudominio.com` |

---

## ⚠️ **PROBLEMA ENCONTRADO Y CORREGIDO**

### **Problema: Botón Signin no Redirige Correctamente**

**Síntoma:**
- Botón "Iniciar Sesión" en Header de Landing redirige a `/login` (relativo)
- Esto lleva a `landing-page/login` en lugar de `platform/login`

**Causa:**
- Hardcoded `window.location.href = '/login'` en lugar de usar variable de entorno

**Solución Aplicada:**
- Cambiado a usar `process.env.NEXT_PUBLIC_FRONTEND_URL`
- Fallback a `http://localhost:3006` si no está definido
- Aplicado en Header.tsx (desktop y mobile)

**Archivos Modificados:**
- ✅ `C:\Dev\landing-page\src\components\layout\Header.tsx`
- ✅ `C:\Dev\landing-page\src\app\login\page.tsx`

---

## 📝 **NOTAS IMPORTANTES**

1. **Landing y Platform son repositorios separados** - Los cambios en uno no afectan al otro
2. **Backend es independiente** - Puede estar en el mismo repo que frontend o separado
3. **Variables de entorno deben estar sincronizadas** entre Landing y Platform
4. **Vercel hace auto-deploy** en cada push a main/master - Verificar que el deploy se completó
5. **CORS está configurado** en backend para permitir ambos orígenes

---

## 🔍 **CÓMO VERIFICAR VERSIONES EN GITHUB**

### **Opción 1: Desde GitHub Web**

1. Ir al repositorio en GitHub
2. Ver branch principal (main/master)
3. Revisar fecha del último commit
4. Verificar que coincide con lo que ves en producción

### **Opción 2: Desde Terminal**

```bash
# Ver commits recientes
git log --oneline -10

# Ver información del último commit
git log -1 --format="%H | %an | %ad | %s" --date=iso

# Comparar con remoto
git fetch origin
git log origin/main..HEAD  # Commits locales sin push
git log HEAD..origin/main  # Commits remotos sin pull
```

### **Opción 3: Verificar SHA del Deploy**

En Vercel:
1. Ir a Deployment específico
2. Ver "Commit" o "Git SHA"
3. Comparar con GitHub: `git show [SHA]`

---

## 📞 **PRÓXIMOS PASOS**

1. **Confirmar URLs de repositorios GitHub:**
   - Landing Page: `?`
   - Platform Dashboard: `?`
   - Backend API: `?`

2. **Verificar variables de entorno en Vercel:**
   - Asegurar que `NEXT_PUBLIC_FRONTEND_URL` y `NEXT_PUBLIC_API_URL` estén configuradas

3. **Probar flujo completo:**
   - Desde Landing → Click Signin → Debe redirigir a Platform
   - Verificar que funciona en desarrollo y producción

---

**¿Necesitas ayuda para verificar los repos de GitHub o configurar las variables de entorno en Vercel?**

