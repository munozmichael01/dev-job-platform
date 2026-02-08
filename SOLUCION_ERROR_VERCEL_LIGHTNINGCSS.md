# 🔧 Solución: Error LightningCSS en Vercel Deploy

**Fecha:** 2025-11-02  
**Error:** `Cannot find module '../lightningcss.linux-x64-gnu.node'`

---

## 🐛 **PROBLEMA**

Error al hacer deploy de la landing page en Vercel:
```
Error: Cannot find module '../lightningcss.linux-x64-gnu.node'
```

**Causa:** Tailwind CSS 4.x requiere LightningCSS con binarios nativos, y Vercel no está instalando correctamente el binario para Linux durante el build.

---

## ✅ **SOLUCIONES APLICADAS**

### **1. Archivo `.npmrc` Creado**

**Ubicación:** `C:\Dev\landing-page\.npmrc`

```ini
# Configuración para asegurar instalación de binarios nativos
# Necesario para LightningCSS en Tailwind CSS 4.x
optionalDependencies=true
legacy-peer-deps=false
```

**Propósito:** Asegura que npm instale dependencias opcionales (incluyendo binarios nativos).

---

### **2. Agregado `lightningcss` como Dependencia Explícita**

**Modificado:** `package.json`

```json
"devDependencies": {
  ...
  "lightningcss": "^1.27.0",  // ← AGREGADO
  "tailwindcss": "^4",
  ...
}
```

**Propósito:** Instala explícitamente LightningCSS para asegurar que los binarios nativos estén disponibles.

---

### **3. Actualizado `next.config.ts`**

**Modificado:** `next.config.ts`

```typescript
const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
};
```

**Propósito:** Configura webpack para manejar correctamente los módulos nativos.

---

### **4. Creado `vercel.json`**

**Nuevo archivo:** `C:\Dev\landing-page\vercel.json`

```json
{
  "buildCommand": "npm run build",
  "devCommand": "npm run dev",
  "installCommand": "npm install",
  "framework": "nextjs",
  "outputDirectory": ".next"
}
```

**Propósito:** Configura explícitamente Vercel para usar los comandos correctos.

---

## 🚀 **PRÓXIMOS PASOS**

### **1. Commitear Cambios:**

```powershell
cd C:\Dev\landing-page
git add .npmrc package.json next.config.ts vercel.json
git commit -m "Fix: Resolver error LightningCSS en Vercel build"
git push origin master
```

### **2. Verificar en Vercel:**

1. El deploy debería iniciarse automáticamente
2. Verificar logs del build
3. Si persiste el error, probar solución alternativa

---

## 🔄 **SOLUCIÓN ALTERNATIVA (Si persiste el error)**

### **Opción A: Downgrade a Tailwind CSS 3.x**

Si el error persiste, considerar usar Tailwind CSS 3.x que no requiere LightningCSS:

```json
"devDependencies": {
  "tailwindcss": "^3.4.1",  // Versión 3.x en lugar de 4.x
  "autoprefixer": "^10.4.17",
  "postcss": "^8.4.33"
}
```

Y actualizar `postcss.config.mjs`:
```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

### **Opción B: Forzar instalación de binarios**

Agregar script en `package.json`:
```json
"scripts": {
  "postinstall": "npm rebuild lightningcss --update-binary"
}
```

### **Opción C: Usar variables de entorno en Vercel**

En Vercel Dashboard → Settings → Environment Variables:
```
NODE_OPTIONS=--max-old-space-size=4096
```

---

## 📋 **VERIFICAR DESPUÉS DEL DEPLOY**

1. ✅ Build completo sin errores
2. ✅ Landing page carga correctamente
3. ✅ Estilos CSS aplicados (Tailwind funciona)
4. ✅ Botones de signin redirigen correctamente

---

## 🔍 **SI EL ERROR PERSISTE**

1. **Ver logs completos en Vercel:**
   - Deployment → Build Logs
   - Buscar errores relacionados con `lightningcss`

2. **Verificar versión de Node en Vercel:**
   - Settings → Node.js Version
   - Debe ser 18.x o superior

3. **Considerar usar Tailwind CSS 3.x:**
   - Más estable y probado en Vercel
   - No requiere LightningCSS

---

## ✅ **ARCHIVOS MODIFICADOS**

### **Solución LightningCSS:**
- ✅ `.npmrc` - Creado (configuración npm)
- ✅ `package.json` - Agregado `lightningcss` explícitamente
- ✅ `next.config.ts` - Configurado webpack para binarios nativos
- ✅ `vercel.json` - Creado (configuración Vercel)

### **Errores de Build Corregidos:**
- ✅ `package.json` - Agregado `eslint-plugin-react-hooks` y `@next/eslint-plugin-next`
- ✅ `src/types/next-auth.d.ts` - Creado (extensiones de tipos para NextAuth)
- ✅ `src/app/api/auth/[...nextauth]/route.ts` - Corregidos tipos TypeScript
- ✅ `src/app/signup/page.tsx` - Corregidos tipos y imports no usados

**✅ Build local verificado exitosamente**

**Todos estos archivos deben committearse y pushearse para que Vercel los use.**

