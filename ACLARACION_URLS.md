# 📍 Aclaración: URLs en Local vs Producción

---

## 🏠 **EN LOCAL (Tu Máquina):**

| Servicio | Puerto | URL Local |
|----------|--------|-----------|
| **Landing Page** | 3000 | `http://localhost:3000` |
| **Platform Dashboard (Frontend)** | 3006 | `http://localhost:3006` |
| **Backend API (Express)** | 3002 | `http://localhost:3002` |

---

## ☁️ **EN PRODUCCIÓN (Vercel/Cloud):**

| Servicio | URL Producción | ¿Dónde está? |
|----------|----------------|--------------|
| **Landing Page** | `https://tu-landing.vercel.app` | ✅ Vercel |
| **Platform Dashboard (Frontend)** | `https://dev-job-platform.vercel.app` | ✅ Vercel |
| **Backend API (Express)** | `https://???` | ❌ **NO está desplegado todavía** |

---

## 🎯 **RESUMEN:**

- ✅ **Frontend (Platform Dashboard):** `https://dev-job-platform.vercel.app` = `localhost:3006`
- ❌ **Backend API:** NO está desplegado todavía
- ❌ **Backend NO puede estar en Vercel** (Vercel no ejecuta servidores Express tradicionales)

---

## 📋 **VARIABLES DE ENTORNO PARA PLATFORM:**

### **Para el proyecto `dev-job-platform` en Vercel:**

```
NEXT_PUBLIC_API_URL = [URL del backend cuando lo despliegues]
NEXT_PUBLIC_LANDING_URL = [URL de la landing en Vercel]
```

**Por ahora, hasta que despliegues el backend:**

```
NEXT_PUBLIC_API_URL = http://localhost:3002  (temporal - solo funcionará en tu máquina)
```

O puedes usar una URL de backend que ya tengas desplegada en Railway/Render/etc.

---

## 🚨 **PREGUNTA IMPORTANTE:**

**¿Ya tienes el backend desplegado en algún lugar?**
- Si SÍ → Dime la URL
- Si NO → Necesitas desplegarlo en Railway/Render primero

---

## ✅ **PARA QUE TODO FUNCIONE:**

1. ✅ Landing Page → Funciona (Vercel)
2. ✅ Platform Dashboard → Funciona (Vercel) 
3. ⏳ Backend API → **Necesita desplegarse en Railway/Render/otro servicio**

**Después de desplegar el backend, actualiza `NEXT_PUBLIC_API_URL` en Vercel con la URL real del backend.**

