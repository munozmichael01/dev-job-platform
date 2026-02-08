# ✅ Valores Exactos para Variables de Entorno - Landing Page

**Fecha:** 2025-11-02  
**Proyecto Landing:** `landing-page`  
**Platform Dashboard:** `https://dev-job-platform.vercel.app/`

---

## 🎯 **VALORES PARA CONFIGURAR**

Basado en tu configuración actual:

### **Variable 1: `NEXT_PUBLIC_FRONTEND_URL`**
**Valor:**
```
https://dev-job-platform.vercel.app
```

**Descripción:** URL del Platform Dashboard donde van los usuarios después del login.

---

### **Variable 2: `NEXT_PUBLIC_API_URL`**

**⚠️ IMPORTANTE:** Necesito verificar dónde está desplegado tu backend.

**Opción A: Si el backend también está en Vercel (mismo proyecto):**
```
https://dev-job-platform.vercel.app
```
(La misma URL - Vercel maneja las rutas `/api/*` automáticamente)

**Opción B: Si el backend está en Railway:**
```
https://tu-proyecto-backend.up.railway.app
```

**Opción C: Si el backend está en Render:**
```
https://tu-proyecto-backend.onrender.com
```

**Opción D: Si el backend está en otro Vercel (proyecto separado):**
```
https://dev-job-platform-api.vercel.app
```

---

## 🔍 **CÓMO VERIFICAR DÓNDE ESTÁ TU BACKEND**

### **Método 1: Revisar en Vercel**

1. Ir a: https://vercel.com/dashboard
2. Buscar proyecto: `dev-job-platform`
3. Ver **Settings → Build & Development Settings**
4. Revisar si hay configuración de **API Routes** o si el backend está como servicio separado

### **Método 2: Revisar en Railway/Render**

1. **Railway:** https://railway.app/dashboard
   - Buscar proyecto del backend
   - Ver URL en Settings → Networking → Public Domain

2. **Render:** https://dashboard.render.com
   - Buscar servicio del backend
   - Ver URL en el dashboard principal

### **Método 3: Probar la URL directamente**

Intenta acceder a:
- `https://dev-job-platform.vercel.app/api/auth/login` (si el backend está en la misma URL)
- O revisa los logs del deploy en Vercel para ver si el backend se desplegó

---

## 📋 **CONFIGURACIÓN EN VERCEL (LANDING PAGE)**

### **Pasos:**

1. **Ir a:**
   ```
   https://vercel.com/munozmichael01-2638s-projects/landing-page/settings/environment-variables
   ```

2. **Agregar Variable 1:**
   - **Key:** `NEXT_PUBLIC_FRONTEND_URL`
   - **Value:** `https://dev-job-platform.vercel.app`
   - **Environments:** ✅ Production, ✅ Preview

3. **Agregar Variable 2:**
   - **Key:** `NEXT_PUBLIC_API_URL`
   - **Value:** [Según donde esté tu backend - ver arriba]
   - **Environments:** ✅ Production, ✅ Preview

4. **Guardar** - Vercel iniciará deploy automático

---

## 🎯 **RECOMENDACIÓN: Empezar con esta configuración**

Si no estás seguro, usa esta configuración inicial y luego ajusta:

```
NEXT_PUBLIC_FRONTEND_URL = https://dev-job-platform.vercel.app
NEXT_PUBLIC_API_URL = https://dev-job-platform.vercel.app
```

**Si el backend no está en la misma URL**, tendrás que:
1. Verificar en Railway/Render cuál es la URL del backend
2. Actualizar la variable `NEXT_PUBLIC_API_URL` con esa URL

---

## ✅ **VERIFICACIÓN DESPUÉS DE CONFIGURAR**

1. **Esperar nuevo deploy** en Vercel (se inicia automáticamente)
2. **Verificar build exitoso** en logs
3. **Probar en producción:**
   - Ir a la landing page desplegada
   - Click en "Sign In" o "Empezar Ahora"
   - Debe redirigir a `https://dev-job-platform.vercel.app/login`
   - Probar registro/login y verificar que las llamadas a la API funcionan

---

## 🆘 **SI ALGO NO FUNCIONA**

### **Error: "Cannot connect to API"**
- Verificar que `NEXT_PUBLIC_API_URL` apunta a la URL correcta del backend
- Verificar que el backend está activo y responde
- Revisar CORS en el backend para permitir requests desde la landing

### **Error: "Redirect not working"**
- Verificar que `NEXT_PUBLIC_FRONTEND_URL` es correcta
- Probar manualmente: `https://dev-job-platform.vercel.app/login` debe existir

---

**🎯 RESUMEN:** Configura `NEXT_PUBLIC_FRONTEND_URL = https://dev-job-platform.vercel.app` y `NEXT_PUBLIC_API_URL` según donde esté tu backend.

