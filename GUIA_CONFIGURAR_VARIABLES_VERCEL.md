# 🎯 Guía: Configurar Variables de Entorno en Vercel - Landing Page

**Fecha:** 2025-11-02  
**Proyecto:** `landing-page` en Vercel

---

## 🔍 **IDENTIFICAR TUS URLS DE PRODUCCIÓN**

Antes de configurar las variables, necesitas identificar las URLs reales de tus servicios:

### **Paso 1: Identificar URL del Platform Dashboard**

El Platform Dashboard es donde los usuarios van después de hacer login desde la landing.

**¿Dónde está desplegado tu Platform Dashboard?**

**Opción A: Si está en Vercel:**
1. Ir a https://vercel.com/dashboard
2. Buscar proyecto del Platform Dashboard (frontend)
3. Ver URL en la sección "Domains" o "Deployments"
4. URL será algo como: `https://nombre-proyecto.vercel.app` o un dominio personalizado

**Opción B: Si está en otro servicio:**
- Railway, Render, Netlify, etc.
- Anotar la URL completa

**Ejemplo:**
- Si el proyecto se llama `job-platform-frontend` → URL: `https://job-platform-frontend.vercel.app`
- O si tienes dominio: `https://platform.tudominio.com`

---

### **Paso 2: Identificar URL del Backend API**

El Backend API es donde la landing hace las llamadas para registro/login.

**¿Dónde está desplegado tu Backend?**

**Opción A: Si está en Railway:**
- URL típica: `https://tu-proyecto.up.railway.app`

**Opción B: Si está en Render:**
- URL típica: `https://tu-proyecto.onrender.com`

**Opción C: Si está en otro Vercel (serverless):**
- URL típica: `https://tu-proyecto-api.vercel.app`

**Opción D: Si está en servidor propio:**
- URL personalizada: `https://api.tudominio.com`

**Ejemplo:**
- `https://job-platform-backend.railway.app`
- `https://api.tudominio.com`

---

## 📋 **VALORES PARA VARIABLES**

### **Variable 1: `NEXT_PUBLIC_FRONTEND_URL`**

Esta es la URL del **Platform Dashboard** (donde van los usuarios después del login).

**Valor para Producción:**
- Si tu Platform Dashboard está en Vercel: `https://nombre-proyecto.vercel.app`
- O si tienes dominio: `https://platform.tudominio.com`

**Ejemplos:**
```
https://job-platform-frontend.vercel.app
https://platform.joboptimizer.com
https://dashboard.joboptimizer.com
```

---

### **Variable 2: `NEXT_PUBLIC_API_URL`**

Esta es la URL del **Backend API** (donde se hacen las llamadas de registro/login).

**Valor para Producción:**
- Si está en Railway: `https://tu-proyecto.up.railway.app`
- Si está en Render: `https://tu-proyecto.onrender.com`
- Si está en Vercel: `https://tu-proyecto-api.vercel.app`
- Si está en servidor: `https://api.tudominio.com`

**Ejemplos:**
```
https://job-platform-backend.railway.app
https://api.joboptimizer.com
https://backend.up.railway.app
```

---

## 🚀 **CONFIGURAR EN VERCEL**

### **Pasos Detallados:**

1. **Ir a Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Buscar y seleccionar proyecto: **`landing-page`**

2. **Ir a Settings:**
   - Click en el proyecto `landing-page`
   - En el menú lateral: **Settings**
   - **Environment Variables**

3. **Agregar Variable 1:**
   - Click **"Add New"**
   - **Key:** `NEXT_PUBLIC_FRONTEND_URL`
   - **Value:** [La URL del Platform Dashboard que identificaste]
   - **Environments:** ✅ Production, ✅ Preview, ✅ Development (si quieres)
   - Click **"Save"**

4. **Agregar Variable 2:**
   - Click **"Add New"** (otra vez)
   - **Key:** `NEXT_PUBLIC_API_URL`
   - **Value:** [La URL del Backend API que identificaste]
   - **Environments:** ✅ Production, ✅ Preview, ✅ Development (si quieres)
   - Click **"Save"**

5. **Verificar:**
   - Deberías ver ambas variables listadas
   - Vercel iniciará automáticamente un nuevo deploy

---

## 🔍 **CÓMO IDENTIFICAR TUS URLS (Si no las conoces)**

### **Para Platform Dashboard en Vercel:**

1. Ir a https://vercel.com/dashboard
2. Buscar el proyecto del **frontend** (Platform Dashboard)
3. Click en el proyecto
4. En **"Deployments"** → Click en el último deploy exitoso
5. Ver URL en la parte superior, o ir a **Settings → Domains**

### **Para Backend API:**

**Si está en Railway:**
1. Ir a https://railway.app
2. Seleccionar proyecto
3. Click en el servicio
4. Ver URL en "Settings → Networking → Public Domain"

**Si está en Render:**
1. Ir a https://render.com
2. Seleccionar servicio
3. Ver URL en el dashboard principal

**Si no estás seguro:**
- Revisar documentación del proyecto
- Revisar archivos `.env.example` o `README.md`
- Preguntar al equipo

---

## ✅ **EJEMPLO COMPLETO**

Supongamos que tienes:

- **Landing Page:** `landing-page.vercel.app`
- **Platform Dashboard:** `job-platform-frontend.vercel.app` (en Vercel)
- **Backend API:** `job-platform-backend.railway.app` (en Railway)

**Variables a configurar:**

```
NEXT_PUBLIC_FRONTEND_URL = https://job-platform-frontend.vercel.app
NEXT_PUBLIC_API_URL = https://job-platform-backend.railway.app
```

---

## 🆘 **SI NO ESTÁS SEGURO DE LAS URLS**

### **Opción 1: Revisar Proyectos Activos**

1. **Railway:** https://railway.app/dashboard
2. **Render:** https://dashboard.render.com
3. **Vercel:** https://vercel.com/dashboard

Revisar todos los proyectos activos y anotar las URLs.

### **Opción 2: Usar URLs Temporales de Desarrollo**

Si no tienes los servicios en producción todavía, puedes usar:

```
NEXT_PUBLIC_FRONTEND_URL = http://localhost:3006
NEXT_PUBLIC_API_URL = http://localhost:3002
```

**⚠️ Nota:** Estas solo funcionarán localmente. Para producción necesitas URLs reales.

---

## 📝 **CHECKLIST**

- [ ] Identificar URL del Platform Dashboard
- [ ] Identificar URL del Backend API
- [ ] Ir a Vercel → Proyecto `landing-page` → Settings → Environment Variables
- [ ] Agregar `NEXT_PUBLIC_FRONTEND_URL` con URL del Platform Dashboard
- [ ] Agregar `NEXT_PUBLIC_API_URL` con URL del Backend API
- [ ] Seleccionar environments (Production, Preview, Development)
- [ ] Guardar
- [ ] Esperar nuevo deploy
- [ ] Verificar que el deploy fue exitoso
- [ ] Probar en producción que los botones de signin redirigen correctamente

---

## 🎯 **RESUMEN RÁPIDO**

1. **Identifica:**
   - URL Platform Dashboard: `https://???`
   - URL Backend API: `https://???`

2. **Configura en Vercel:**
   - Proyecto: `landing-page`
   - Variables:
     - `NEXT_PUBLIC_FRONTEND_URL` = URL del Platform Dashboard
     - `NEXT_PUBLIC_API_URL` = URL del Backend API

3. **Verifica:**
   - Nuevo deploy se inicia automáticamente
   - Build exitoso
   - Funciona en producción

---

**¿Necesitas ayuda identificando tus URLs? Revisa tus proyectos en Railway, Render o Vercel.**

