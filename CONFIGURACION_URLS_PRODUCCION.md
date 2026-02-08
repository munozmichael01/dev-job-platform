# 🔗 Configuración de URLs en Producción

## 📊 URLs Finales del Sistema

```
Landing Page:  https://landing-page-chi-one-12.vercel.app
Frontend App:  https://dev-job-platform-frontend.vercel.app
Backend API:   https://dev-job-platform-backend.vercel.app
```

---

## ⚙️ Variables de Entorno por Proyecto

### **1. Landing Page (`landing-page-chi-one-12`)**

Variables en Vercel Settings → Environment Variables:

```bash
NEXT_PUBLIC_API_URL=https://dev-job-platform-backend.vercel.app
NEXT_PUBLIC_PLATFORM_URL=https://dev-job-platform-frontend.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://bdswyiapdxnxexfzwzhv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_brbj19Bs8N0RQ2E77jEIZA_DaiYN1Eg
```

**¿Qué hace cada una?**
- `NEXT_PUBLIC_API_URL`: Backend para autenticación
- `NEXT_PUBLIC_PLATFORM_URL`: URL del dashboard/plataforma (redirección después de login)
- `NEXT_PUBLIC_SUPABASE_*`: Conexión directa a Supabase (opcional)

---

### **2. Frontend Platform (`dev-job-platform-frontend`)**

Variables en Vercel Settings → Environment Variables:

```bash
NEXT_PUBLIC_API_URL=https://dev-job-platform-backend.vercel.app
NEXT_PUBLIC_LANDING_URL=https://landing-page-chi-one-12.vercel.app
NEXT_PUBLIC_SUPABASE_URL=https://bdswyiapdxnxexfzwzhv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_brbj19Bs8N0RQ2E77jEIZA_DaiYN1Eg
```

**¿Qué hace cada una?**
- `NEXT_PUBLIC_API_URL`: Backend para todas las operaciones
- `NEXT_PUBLIC_LANDING_URL`: URL de la landing (para botón "Salir" o logout)
- `NEXT_PUBLIC_SUPABASE_*`: Conexión directa a Supabase

---

### **3. Backend API (`dev-job-platform-backend`)**

Variables en Vercel Settings → Environment Variables:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://bdswyiapdxnxexfzwzhv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_brbj19Bs8N0RQ2E77jEIZA_DaiYN1Eg
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_PASSWORD=pMKbL30XpDPF1d9L
JWT_SECRET=dev-secret-key
NODE_ENV=production
CORS_ORIGIN=https://dev-job-platform-frontend.vercel.app,https://landing-page-chi-one-12.vercel.app
```

**¿Qué hace cada una?**
- `SUPABASE_*`: Conexión a base de datos
- `JWT_SECRET`: Para generar tokens de autenticación
- `CORS_ORIGIN`: URLs permitidas para hacer requests al backend (ambas: landing + frontend)

---

## 🔄 Flujo de Autenticación Correcto

```
1. Usuario visita: https://landing-page-chi-one-12.vercel.app
2. Hace clic en "Iniciar sesión" → Va a /login en la MISMA landing
3. Login envía credenciales a: https://dev-job-platform-backend.vercel.app/api/auth/login
4. Backend valida y devuelve token JWT
5. Landing redirige a: https://dev-job-platform-frontend.vercel.app/ (dashboard)
6. Frontend usa token para acceder a datos protegidos
```

---

## ✅ Pasos para Aplicar Configuración

### **Paso 1: Actualizar Landing Page**

1. Ve a Vercel → Proyecto `landing-page-chi-one-12`
2. Settings → Environment Variables
3. **Agrega o actualiza:**
   - `NEXT_PUBLIC_PLATFORM_URL` = `https://dev-job-platform-frontend.vercel.app`
4. Deployments → Redeploy

### **Paso 2: Actualizar Frontend Platform**

1. Ve a Vercel → Proyecto `dev-job-platform-frontend`
2. Settings → Environment Variables
3. **Agrega o actualiza:**
   - `NEXT_PUBLIC_API_URL` = `https://dev-job-platform-backend.vercel.app`
   - `NEXT_PUBLIC_LANDING_URL` = `https://landing-page-chi-one-12.vercel.app`
4. Deployments → Redeploy

### **Paso 3: Actualizar Backend (IMPORTANTE - CORS)**

1. Ve a Vercel → Proyecto `dev-job-platform-backend`
2. Settings → Environment Variables
3. **Agrega o actualiza:**
   - `CORS_ORIGIN` = `https://dev-job-platform-frontend.vercel.app,https://landing-page-chi-one-12.vercel.app`
4. Deployments → Redeploy

---

## 🧪 Testing Después de Configurar

### **Test 1: Landing Page**
1. Visita: `https://landing-page-chi-one-12.vercel.app`
2. Clic en "Iniciar sesión"
3. ✅ Debe ir a `/login` en la misma landing (NO a otra URL)

### **Test 2: Login**
1. Ingresa credenciales: `test.new.user@example.com` / `password123`
2. ✅ Debe redirigir a: `https://dev-job-platform-frontend.vercel.app/`

### **Test 3: Dashboard**
1. Dashboard debe cargar
2. ✅ Debe mostrar datos del usuario (campañas, ofertas, etc.)

---

## 🚨 Problemas Comunes

**Problema:** "404 NOT FOUND" en login
- **Causa:** Botón redirige a URL incorrecta
- **Solución:** Verificar que `NEXT_PUBLIC_PLATFORM_URL` esté configurada en la landing

**Problema:** "Internal Server Error" en frontend
- **Causa:** `NEXT_PUBLIC_API_URL` apunta a localhost
- **Solución:** Actualizar a URL de backend en producción

**Problema:** "CORS Error" en requests
- **Causa:** Backend no permite requests desde landing/frontend
- **Solución:** Actualizar `CORS_ORIGIN` en backend con ambas URLs

---

## 📝 Checklist Final

- [ ] Landing tiene `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_PLATFORM_URL`
- [ ] Frontend tiene `NEXT_PUBLIC_API_URL` y `NEXT_PUBLIC_LANDING_URL`
- [ ] Backend tiene `CORS_ORIGIN` con ambas URLs (separadas por coma)
- [ ] Los 3 proyectos redeployados
- [ ] Login funciona correctamente
- [ ] Dashboard carga datos
