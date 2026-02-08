# ✅ Configuración Correcta de Vercel para Frontend

## 🚨 PROBLEMA ACTUAL

Error en deployment:
```
Running "install" command: `cd frontend && npm install`...
sh: line 1: cd: frontend: No such file or directory
```

**Causa:** Tienes configurado un "Install Command" manual que intenta hacer `cd frontend`, pero Vercel ya está DENTRO de la carpeta `frontend/` porque configuraste "Root Directory: frontend".

---

## ✅ SOLUCIÓN: Configuración Correcta en Vercel

### **1. Ve a tu proyecto en Vercel Dashboard**
https://vercel.com/munozmichael01s-projects/job-platform-frontend/settings

### **2. Ve a Settings > General**

### **3. Build & Development Settings:**

```yaml
Framework Preset: Next.js

Root Directory: frontend
  ↑ Esto hace que Vercel entre automáticamente a frontend/

Build Command:
  [DEJAR VACÍO o usar el default de Next.js]
  ❌ NO: cd frontend && npm run build
  ✅ SÍ: (vacío) - Vercel usa npm run build automáticamente

Output Directory:
  [DEJAR VACÍO - Next.js usa .next por defecto]

Install Command:
  [DEJAR VACÍO]
  ❌ NO: cd frontend && npm install
  ✅ SÍ: (vacío) - Vercel usa npm install automáticamente
```

### **4. IMPORTANTE: Cómo eliminar los comandos override**

Si ves un campo con texto (como "cd frontend && npm install"):
1. **Haz clic en el botón "Edit"** junto al campo
2. **Borra TODO el texto** del campo
3. **Haz clic en "Save"**
4. Verifica que diga "(Default)" o esté vacío

---

## 🎯 Configuración Final Esperada

```
Framework Preset:     Next.js
Root Directory:       frontend
Build Command:        (Default) ← NO edites esto
Output Directory:     (Default) ← NO edites esto
Install Command:      (Default) ← NO edites esto
```

---

## 📋 Environment Variables (Ya Configuradas ✅)

```
NEXT_PUBLIC_SUPABASE_URL = https://bdswyiapdxnxexfzwzhv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = sb_publishable_brbj19Bs8N0RQ2E77jEIZA_DaiYN1Eg
NEXT_PUBLIC_API_URL = https://job-platform-backend.vercel.app
```

*(La URL del backend la actualizarás cuando despliegues el backend)*

---

## 🚀 Después de Aplicar los Cambios

1. **Guarda la configuración** en Vercel
2. **NO necesitas hacer redeploy manual** - Vercel debería intentar automáticamente
3. Si no arranca solo, ve a "Deployments" y haz clic en "Redeploy"

---

## ✅ Resultado Esperado

El deployment debería:
1. Clonar el repo
2. Entrar a `frontend/` automáticamente (por Root Directory)
3. Ejecutar `npm install` (comando default)
4. Ejecutar `npm run build` (comando default de Next.js)
5. Desplegar exitosamente

---

## 🔧 Si Aún Falla

Comparte el nuevo error log completo y lo revisamos juntos.
