# 🔧 Solución: Error Variables de Entorno en Vercel

**Fecha:** 2025-11-02  
**Error:** `Environment Variable "NEXT_PUBLIC_FRONTEND_URL" references Secret "next_public_frontend_url", which does not exist.`

---

## 🐛 **PROBLEMA**

El archivo `vercel.json` estaba configurado para usar Secrets de Vercel que no existen:

```json
"env": {
  "NEXT_PUBLIC_FRONTEND_URL": "@next_public_frontend_url",
  "NEXT_PUBLIC_API_URL": "@next_public_api_url"
}
```

El prefijo `@` en Vercel indica que debe buscar un Secret, pero estos secrets no están creados en Vercel.

---

## ✅ **SOLUCIÓN APLICADA**

### **1. Eliminado `env` de `vercel.json`**

Las variables de entorno de Next.js (`NEXT_PUBLIC_*`) deben configurarse directamente en Vercel Dashboard, no a través de `vercel.json` con formato de secrets.

**Archivo corregido:**
```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs"
}
```

---

## 🚀 **CONFIGURAR VARIABLES EN VERCEL DASHBOARD**

Ahora debes agregar las variables de entorno **directamente en Vercel**:

### **Pasos:**

1. **Ir a Vercel Dashboard:**
   - https://vercel.com/dashboard
   - Seleccionar proyecto `landing-page`

2. **Ir a Settings:**
   - Click en el proyecto
   - Settings → Environment Variables

3. **Agregar Variables:**

   **Variable 1:**
   - **Key:** `NEXT_PUBLIC_FRONTEND_URL`
   - **Value:** `https://dev-job-platform.vercel.app`
     - Esta es la URL del Platform Dashboard donde van los usuarios después del login
   - **Environments:** ✅ Production, ✅ Preview

   **Variable 2:**
   - **Key:** `NEXT_PUBLIC_API_URL`
   - **Value:** Depende de donde esté el backend:
     - Si backend está en la misma URL de Vercel: `https://dev-job-platform.vercel.app`
     - Si backend está en Railway: `https://tu-proyecto.up.railway.app`
     - Si backend está en Render: `https://tu-proyecto.onrender.com`
     - Si backend está en otro Vercel: `https://tu-proyecto-api.vercel.app`
   - **Environments:** ✅ Production, ✅ Preview

4. **Guardar:**
   - Click "Save"
   - Vercel hará un nuevo deploy automáticamente

---

## 📋 **VALORES RECOMENDADOS**

### **Para Producción:**
```
NEXT_PUBLIC_FRONTEND_URL=https://platform.tudominio.com
NEXT_PUBLIC_API_URL=https://api.tudominio.com
```

### **Para Preview (Pull Requests):**
```
NEXT_PUBLIC_FRONTEND_URL=https://platform-preview.tudominio.com
NEXT_PUBLIC_API_URL=https://api-preview.tudominio.com
```

### **Para Development (opcional):**
```
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3006
NEXT_PUBLIC_API_URL=http://localhost:3002
```

**Nota:** Las variables `NEXT_PUBLIC_*` están disponibles en el cliente (browser), así que asegúrate de que no contengan información sensible.

---

## ✅ **VERIFICAR DEPLOY**

Después de configurar las variables:

1. **Esperar nuevo deploy automático** (se inicia al guardar variables)
2. **Verificar logs:**
   - Deployments → Último deploy → Build Logs
   - Debe compilar sin errores
3. **Probar en producción:**
   - Verificar que los botones de signin redirigen correctamente
   - Verificar que las llamadas a la API funcionan

---

## 🔍 **ARCHIVOS MODIFICADOS**

- ✅ `vercel.json` - Eliminada sección `env` con referencias a secrets

---

## 📝 **PRÓXIMOS PASOS**

1. ✅ Commit y push del `vercel.json` corregido
2. ⏳ Configurar variables en Vercel Dashboard (ver pasos arriba)
3. ⏳ Esperar nuevo deploy
4. ⏳ Verificar que funciona correctamente

---

## 🆘 **SI EL ERROR PERSISTE**

### **Error: "Variable not found"**
- Verificar que agregaste las variables en Vercel Dashboard
- Verificar que están habilitadas para el environment correcto (Production/Preview/Development)

### **Error: "Build fails"**
- Verificar que los valores de las variables son URLs válidas
- Verificar que no hay espacios extra en los valores
- Verificar logs de build en Vercel para más detalles

---

**✅ SOLUCIÓN:** Eliminada referencia a secrets inexistentes. Variables deben configurarse en Vercel Dashboard.

