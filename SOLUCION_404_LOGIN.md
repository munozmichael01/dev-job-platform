# 🔧 Solución: 404 en /login - Platform Dashboard

**Error:** `https://dev-job-platform.vercel.app/login` da 404

---

## 🔍 **DIAGNÓSTICO:**

La ruta `/login` existe en el código (`frontend/app/login/page.tsx`), pero Vercel no la encuentra.

**Posibles causas:**
1. ✅ Vercel no está configurado para usar la carpeta `frontend/`
2. ✅ El build no está generando la ruta correctamente
3. ✅ Hay un error en el código que impide el build

---

## ✅ **SOLUCIONES:**

### **Solución 1: Verificar Configuración de Vercel**

Vercel necesita saber que debe construir desde la carpeta `frontend/`:

1. **Ir a:** https://vercel.com/dashboard
2. **Proyecto:** `dev-job-platform`
3. **Settings → Build & Development Settings**
4. **Verificar:**
   - **Root Directory:** Debe ser `frontend` o `.` (según cómo esté configurado)
   - **Build Command:** `cd frontend && npm run build` (o `npm run build` si root es `frontend`)
   - **Output Directory:** `frontend/.next` (o `.next` si root es `frontend`)

### **Solución 2: Crear vercel.json en la Raíz del Monorepo**

Si Vercel está desplegando desde la raíz del monorepo, necesita configuración:

**Crear:** `C:\Dev\job-platform\vercel.json`

```json
{
  "buildCommand": "cd frontend && npm install && npm run build",
  "outputDirectory": "frontend/.next",
  "framework": "nextjs",
  "installCommand": "cd frontend && npm install"
}
```

### **Solución 3: Cambiar Root Directory en Vercel**

1. **Vercel Dashboard → Proyecto `dev-job-platform`**
2. **Settings → General**
3. **Root Directory:** Cambiar a `frontend`
4. **Save**
5. **Redeploy**

---

## 📝 **CÓDIGO CORREGIDO:**

He actualizado `login/page.tsx` para usar la variable de entorno en lugar de `localhost` hardcodeado:

```typescript
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'
const response = await fetch(`${apiUrl}/api/auth/login`, {
```

---

## 🚀 **PASOS RECOMENDADOS:**

### **Opción A: Si Vercel está configurado para raíz del monorepo:**

1. Crear `vercel.json` en la raíz (ver Solución 2)
2. Commit y push
3. Vercel hará redeploy automático

### **Opción B: Si Vercel debe usar carpeta frontend:**

1. Configurar Root Directory = `frontend` (ver Solución 3)
2. Redeploy manual

---

## ✅ **VERIFICAR DESPUÉS:**

1. Deploy exitoso en Vercel
2. Ir a: `https://dev-job-platform.vercel.app/login`
3. Debe cargar la página de login (no 404)

---

**¿Cuál es la configuración actual de Vercel para `dev-job-platform`?**

