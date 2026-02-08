# 🚀 Deploy a Vercel - Paso a Paso

**Fecha:** 2025-11-02

---

## 📋 **SITUACIÓN ACTUAL:**

✅ Landing Page: Repositorio separado (`landing-page`)  
✅ Platform: Monorepo (`dev-job-platform`) con frontend y backend  
⚠️ Backend: Express (Node.js) - **NO puede desplegarse en Vercel directamente**

---

## 🎯 **PASO 1: ARREGLAR LANDING PAGE EN VERCEL**

### **1.1 Commitear y Pushear los Cambios**

Primero, asegúrate de que todos los cambios estén en GitHub:

```powershell
cd C:\Dev\landing-page
git status
```

Si hay archivos modificados:

```powershell
git add .
git commit -m "Fix: Eliminar referencias a secrets inexistentes y corregir tipos TypeScript"
git push origin master
```

### **1.2 Configurar Variables de Entorno en Vercel**

1. **Abrir:** https://vercel.com/dashboard
2. **Click en proyecto:** `landing-page`
3. **Click:** Settings (menú lateral)
4. **Click:** Environment Variables
5. **Agregar Variable 1:**
   - Click: "Add New"
   - **Key:** `NEXT_PUBLIC_FRONTEND_URL`
   - **Value:** `https://dev-job-platform.vercel.app`
   - **Environments:** ✅ Production, ✅ Preview
   - **Click:** Save
6. **Agregar Variable 2:**
   - Click: "Add New"
   - **Key:** `NEXT_PUBLIC_API_URL`
   - **Value:** `https://dev-job-platform.vercel.app` *(temporal - ver nota abajo)*
   - **Environments:** ✅ Production, ✅ Preview
   - **Click:** Save

### **1.3 Verificar Deploy**

1. Vercel iniciará deploy automático al agregar variables
2. Ir a: **Deployments** (menú lateral)
3. Verificar que el último deploy está en "Building..." o "Ready"
4. Si hay error, click en el deploy y ver los logs

**✅ Landing Page debería estar funcionando ahora**

---

## 🔍 **PASO 2: VERIFICAR PLATFORM (Frontend + Backend)**

### **2.1 Entender la Situación**

**IMPORTANTE:** Vercel NO puede ejecutar servidores Express tradicionales.

- ✅ **Frontend (Next.js):** SÍ se despliega en Vercel
- ❌ **Backend (Express):** NO se despliega en Vercel (necesita Railway/Render/etc.)

Si dices que "ya está en Vercel e incluye el back y el front", probablemente:
- Solo el **frontend** está desplegado en Vercel
- El **backend** está en otro servicio O no está desplegado

### **2.2 Verificar qué está Desplegado**

1. **Abrir:** https://vercel.com/dashboard
2. **Buscar proyecto:** `dev-job-platform`
3. **Click en el proyecto**
4. **Ver Settings → Build & Development Settings**
   - Verificar qué carpeta está configurada para build
   - Probablemente está configurado para `frontend/`

### **2.3 Si Solo Frontend está en Vercel**

**Configuración Actual (probable):**
- **Root Directory:** `frontend` o `.`
- **Build Command:** `cd frontend && npm run build`
- **Output Directory:** `frontend/.next`

**Variables de Entorno Necesarias:**

1. Ir a: Settings → Environment Variables
2. Verificar que tiene:
   ```
   NEXT_PUBLIC_API_URL = [URL del backend - ver abajo]
   ```

**⚠️ PROBLEMA:** El backend NO está en Vercel, así que necesitas:
- Desplegar backend en Railway/Render
- O usar la URL del backend que ya tengas desplegado

---

## 🚨 **PASO 3: ¿DÓNDE ESTÁ EL BACKEND?**

### **Opción A: Backend NO está Desplegado**

Necesitas desplegarlo. **Recomendación: Railway (gratis y fácil)**

**Pasos para Railway:**
1. Ir a: https://railway.app
2. Sign up con GitHub
3. New Project → Deploy from GitHub repo
4. Seleccionar: `dev-job-platform`
5. **Root Directory:** `backend`
6. Railway detectará Node.js automáticamente
7. Agregar variables de entorno:
   - `PORT` = 3002 (o dejar por defecto)
   - `DB_SERVER` = [tu servidor DB]
   - `DB_DATABASE` = [tu base de datos]
   - `DB_USER` = [tu usuario]
   - `DB_PASSWORD` = [tu password]
   - `JWT_SECRET` = [tu secret]
   - `ALLOWED_ORIGINS` = `https://dev-job-platform.vercel.app,https://tu-landing.vercel.app`
8. Railway dará una URL: `https://tu-proyecto.up.railway.app`
9. **Usar esa URL** para `NEXT_PUBLIC_API_URL`

### **Opción B: Backend YA está Desplegado**

Si ya tienes el backend desplegado en algún lugar:
- Identificar la URL (Railway, Render, servidor propio)
- Usar esa URL para `NEXT_PUBLIC_API_URL`

---

## 📝 **PASO 4: CONFIGURAR VARIABLES EN PLATFORM (Frontend)**

Una vez que sepas dónde está el backend:

1. **Abrir:** https://vercel.com/dashboard
2. **Click en proyecto:** `dev-job-platform`
3. **Settings → Environment Variables**
4. **Agregar/Actualizar:**
   ```
   NEXT_PUBLIC_API_URL = [URL real del backend]
   NEXT_PUBLIC_LANDING_URL = [URL de la landing en Vercel]
   ```
5. **Save** → Vercel hará redeploy automático

---

## ✅ **CHECKLIST FINAL**

- [ ] Landing Page: Variables configuradas en Vercel
- [ ] Landing Page: Deploy exitoso
- [ ] Platform Frontend: Variables configuradas en Vercel
- [ ] Backend: Desplegado en Railway/Render/otro
- [ ] Backend: URL identificada y configurada en Platform
- [ ] Todo funciona en producción

---

## 🆘 **SI ALGO FALLA**

### **Error en Landing: "Cannot find module"**
- Verificar que todos los cambios están pusheados a GitHub
- Verificar que Vercel está usando el branch correcto (`master`)

### **Error: "API connection failed"**
- Verificar que el backend está desplegado y corriendo
- Verificar que `NEXT_PUBLIC_API_URL` tiene la URL correcta
- Verificar CORS en backend permite el origen de la landing

### **Error: "Redirect not working"**
- Verificar `NEXT_PUBLIC_FRONTEND_URL` en landing
- Verificar que Platform Frontend está desplegado

---

**🎯 EMPEZAMOS CON PASO 1 - ¿Listo?**

