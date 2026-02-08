# ⚡ Configuración CONCRETA - Variables de Entorno Vercel

**Fecha:** 2025-11-02

---

## 🎯 **LO QUE SABEMOS:**

- ✅ Frontend (Platform Dashboard): `https://dev-job-platform.vercel.app`
- ❌ Backend: NO está desplegado en producción (es Express, necesita Railway/Render/servidor propio)

---

## 📋 **VALORES EXACTOS A CONFIGURAR:**

### **En Vercel Dashboard:**

**URL:** https://vercel.com/dashboard → Proyecto `landing-page` → Settings → Environment Variables

**Variable 1:**
```
Key: NEXT_PUBLIC_FRONTEND_URL
Value: https://dev-job-platform.vercel.app
Environments: ✅ Production, ✅ Preview
```

**Variable 2:**
```
Key: NEXT_PUBLIC_API_URL
Value: https://dev-job-platform.vercel.app
Environments: ✅ Production, ✅ Preview
```

**⚠️ NOTA:** Si el backend no está desplegado, esto NO funcionará. El backend necesita estar en Railway, Render, o servidor propio primero.

---

## 🚨 **PROBLEMA: Backend NO está desplegado**

Tu backend es un servidor Express que necesita correr 24/7. Vercel NO puede ejecutarlo.

### **Opción 1: Desplegar Backend en Railway (Recomendado - Gratis)**

1. Ir a: https://railway.app
2. Sign up con GitHub
3. New Project → Deploy from GitHub repo
4. Seleccionar `dev-job-platform` → Carpeta `backend`
5. Railway detectará Node.js automáticamente
6. Agregar variables de entorno (DB connection, JWT_SECRET, etc.)
7. Railway dará una URL: `https://tu-proyecto.up.railway.app`
8. **Usar esa URL para `NEXT_PUBLIC_API_URL`**

### **Opción 2: Desplegar Backend en Render (Gratis también)**

1. Ir a: https://render.com
2. Sign up
3. New → Web Service
4. Conectar repo `dev-job-platform`
5. Root Directory: `backend`
6. Build Command: `npm install`
7. Start Command: `npm start`
8. Agregar variables de entorno
9. Render dará: `https://tu-proyecto.onrender.com`
10. **Usar esa URL para `NEXT_PUBLIC_API_URL`**

---

## ✅ **ACCIONES INMEDIATAS:**

**Para que la landing funcione AHORA (sin backend desplegado):**

1. Configura estas variables en Vercel (aunque el backend no esté):
   ```
   NEXT_PUBLIC_FRONTEND_URL = https://dev-job-platform.vercel.app
   NEXT_PUBLIC_API_URL = https://dev-job-platform.vercel.app
   ```

2. La landing redirigirá correctamente al dashboard
3. El login/registro NO funcionará hasta que despliegues el backend

**Después de desplegar el backend:**
- Actualiza `NEXT_PUBLIC_API_URL` con la URL real del backend (Railway/Render)

---

## 📝 **PASOS EXACTOS EN VERCEL:**

1. **Abrir:** https://vercel.com/dashboard
2. **Click en proyecto:** `landing-page`
3. **Click:** Settings (menú lateral)
4. **Click:** Environment Variables
5. **Click:** Add New
6. **Escribir:**
   - Key: `NEXT_PUBLIC_FRONTEND_URL`
   - Value: `https://dev-job-platform.vercel.app`
   - Marcar: ✅ Production, ✅ Preview
7. **Click:** Save
8. **Click:** Add New (otra vez)
9. **Escribir:**
   - Key: `NEXT_PUBLIC_API_URL`
   - Value: `https://dev-job-platform.vercel.app` (temporal hasta desplegar backend)
   - Marcar: ✅ Production, ✅ Preview
10. **Click:** Save
11. **Listo** - Vercel hace deploy automático

---

**🎯 RESUMEN:** Configura las 2 variables con `https://dev-job-platform.vercel.app` por ahora. Después despliega el backend y actualiza `NEXT_PUBLIC_API_URL`.

