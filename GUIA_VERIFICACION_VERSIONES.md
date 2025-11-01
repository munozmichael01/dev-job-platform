# 🔍 Guía Completa: Verificar Versiones en GitHub y Vercel

**Última actualización:** 2025-11-02

---

## 📦 **REPOSITORIOS IDENTIFICADOS**

### **1. Landing Page**
- **Ubicación Local:** `C:\Dev\landing-page`
- **GitHub:** https://github.com/munozmichael01/landing-page
- **Branch:** `master`
- **Último Commit:** `d7b48d5` - "Update page.tsx" (2025-08-22)
- **Estado:** ⚠️ **Tiene cambios sin commit** (Header.tsx, login/page.tsx, dashboard-redirect/page.tsx)

### **2. Platform Dashboard (Frontend)**
- **Ubicación Local:** `C:\Dev\job-platform\frontend`
- **GitHub:** https://github.com/munozmichael01/dev-job-platform (monorepo)
- **Branch:** `main`
- **Último Commit:** `703211b` - "documentacion" (2025-11-02 00:30)

### **3. Backend API**
- **Ubicación Local:** `C:\Dev\job-platform\backend`
- **GitHub:** https://github.com/munozmichael01/dev-job-platform (monorepo)
- **Branch:** `main`
- **Último Commit:** `703211b` - "documentacion" (2025-11-02 00:30)

**Nota:** Frontend y Backend están en el mismo repositorio (monorepo).

---

## 🚀 **VERIFICACIÓN RÁPIDA CON SCRIPTS**

### **Script 1: Landing Page**

```powershell
# Ejecutar desde C:\Dev\landing-page
.\verificar-version.ps1
```

**O manualmente:**
```powershell
cd C:\Dev\landing-page
git remote -v
git log -1 --format="%H | %an | %ad | %s" --date=iso
git status
git log origin/master..HEAD --oneline
```

### **Script 2: Platform (Frontend + Backend)**

```powershell
# Ejecutar desde C:\Dev\job-platform
.\verificar-version.ps1
```

**O manualmente:**
```powershell
cd C:\Dev\job-platform
git remote -v
git log -1 --format="%H | %an | %ad | %s" --date=iso
cd frontend; git log -1; cd ..
cd backend; git log -1; cd ..
```

---

## 📋 **VERIFICACIÓN MANUAL PASO A PASO**

### **Paso 1: Verificar Estado Local**

#### **Para Landing Page:**
```powershell
cd C:\Dev\landing-page
git status
git log -1
```

#### **Para Platform:**
```powershell
cd C:\Dev\job-platform
git status
git log -1
cd frontend
git log -1
cd ..\backend
git log -1
```

**Qué buscar:**
- ✅ "Your branch is up to date" = Todo sincronizado
- ⚠️ "Changes not staged for commit" = Hay cambios sin commit
- ⚠️ "Your branch is ahead" = Hay commits sin push

---

### **Paso 2: Verificar en GitHub**

#### **Método 1: Navegador Web**

1. **Landing Page:**
   - Ir a: https://github.com/munozmichael01/landing-page
   - Ver branch `master`
   - Revisar fecha del último commit
   - Comparar SHA con: `git rev-parse HEAD` (local)

2. **Platform:**
   - Ir a: https://github.com/munozmichael01/dev-job-platform
   - Ver branch `main`
   - Navegar a carpeta `frontend/` o `backend/`
   - Ver fecha del último commit

#### **Método 2: Terminal**

```powershell
# Landing Page
cd C:\Dev\landing-page
git fetch origin
git log origin/master -1 --format="%H | %ad | %s" --date=iso
git rev-parse HEAD  # Comparar con commit en GitHub

# Platform
cd C:\Dev\job-platform
git fetch origin
git log origin/main -1 --format="%H | %ad | %s" --date=iso
```

**Comparar:**
- Si el SHA local coincide con el remoto → Estás actualizado
- Si difiere → Hay cambios pendientes

---

### **Paso 3: Verificar en Vercel**

#### **3.1 Acceder a Vercel Dashboard**

1. Ir a: https://vercel.com/dashboard
2. Iniciar sesión con tu cuenta
3. Seleccionar el proyecto correspondiente:
   - **Landing Page:** Buscar proyecto "landing-page"
   - **Platform Dashboard:** Buscar proyecto "job-platform-frontend" o similar

#### **3.2 Verificar Último Deploy**

Para cada proyecto:

1. **Ver información del deploy:**
   - Fecha/hora del último deploy
   - Commit SHA desplegado
   - Estado del deploy (Success/Failed)

2. **Comparar con GitHub:**
   ```
   Commit en Vercel: abc123...
   Commit en GitHub: abc123... ✅ Coincide
   ```

3. **Verificar logs:**
   - Click en el deploy
   - Ver "Build Logs"
   - Verificar que no hay errores

#### **3.3 Verificar Variables de Entorno en Vercel**

Para cada proyecto en Vercel:

1. **Settings → Environment Variables**
2. **Verificar que existen:**
   - `NEXT_PUBLIC_FRONTEND_URL` (en Landing)
   - `NEXT_PUBLIC_API_URL` (en Landing y Platform)
   - `NEXT_PUBLIC_LANDING_URL` (en Platform)

3. **Verificar valores:**
   - Desarrollo: URLs con `localhost`
   - Producción: URLs con dominios reales

---

## 🔍 **VERIFICAR SI ESTÁS VIENDO LA ÚLTIMA VERSIÓN**

### **Checklist Completo:**

#### **✅ En Local:**
- [ ] `git pull` en todos los repositorios
- [ ] No hay cambios sin commit (`git status` limpio)
- [ ] No hay commits sin push
- [ ] Branch actual es `main` o `master`

#### **✅ En GitHub:**
- [ ] Último commit en GitHub coincide con local
- [ ] SHA del commit coincide
- [ ] No hay commits en GitHub que no tengas localmente
- [ ] Branch principal es `main` o `master`

#### **✅ En Vercel:**
- [ ] Último deploy en Vercel es reciente
- [ ] Commit SHA en Vercel coincide con GitHub
- [ ] Deploy fue exitoso (sin errores)
- [ ] Variables de entorno configuradas correctamente

---

## 📊 **COMANDOS ÚTILES**

### **Ver último commit:**
```powershell
git log -1 --format="%H | %an | %ad | %s" --date=iso
```

### **Ver cambios sin commit:**
```powershell
git status
git diff  # Ver cambios en detalle
```

### **Ver commits sin push:**
```powershell
git fetch origin
git log origin/[branch]..HEAD --oneline
```

### **Ver commits remotos sin pull:**
```powershell
git fetch origin
git log HEAD..origin/[branch] --oneline
```

### **Ver URL del commit en GitHub:**
```powershell
$sha = git rev-parse HEAD
$repo = (git remote get-url origin) -replace '\.git$', '' -replace 'git@github\.com:', 'https://github.com/'
Write-Host "$repo/commit/$sha"
```

---

## 🎯 **VERIFICACIÓN ESPECÍFICA POR PROYECTO**

### **Landing Page**

**Repositorio:** https://github.com/munozmichael01/landing-page

**Verificar:**
```powershell
cd C:\Dev\landing-page
git fetch origin
git log -1
git log origin/master -1
# Comparar ambos SHAs - deben coincidir
```

**Vercel:**
- Buscar proyecto "landing-page" en dashboard
- Verificar último deploy
- Verificar variables: `NEXT_PUBLIC_FRONTEND_URL`, `NEXT_PUBLIC_API_URL`

---

### **Platform Dashboard (Frontend)**

**Repositorio:** https://github.com/munozmichael01/dev-job-platform (carpeta `frontend/`)

**Verificar:**
```powershell
cd C:\Dev\job-platform\frontend
git log -1
git log origin/main -1
# Verificar que el SHA coincide
```

**Vercel:**
- Buscar proyecto "job-platform-frontend" o similar
- Verificar último deploy
- Verificar variables: `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_LANDING_URL`

---

### **Backend API**

**Repositorio:** https://github.com/munozmichael01/dev-job-platform (carpeta `backend/`)

**Verificar:**
```powershell
cd C:\Dev\job-platform\backend
git log -1
git log origin/main -1
```

**Deploy:**
- Probablemente Railway, Render, o servidor propio
- Verificar última actualización del servicio
- Verificar variables de entorno del servidor

---

## ⚠️ **PROBLEMAS COMUNES Y SOLUCIONES**

### **Problema 1: "Vercel muestra versión antigua"**

**Causas posibles:**
- Cambios no fueron pusheados a GitHub
- Deploy en Vercel falló
- Vercel está desplegando branch incorrecto

**Solución:**
```powershell
# 1. Verificar que cambios están en GitHub
git push origin main

# 2. Verificar que Vercel detectó el push
# Ir a Vercel → Ver "Deployments" → Verificar nuevo deploy

# 3. Si no hay deploy, hacer deploy manual
# Vercel Dashboard → Deployments → "Redeploy"
```

---

### **Problema 2: "Local y GitHub no coinciden"**

**Solución:**
```powershell
# Si GitHub tiene cambios que no tienes:
git pull origin main

# Si tienes cambios que no están en GitHub:
git push origin main

# Si hay conflictos:
git pull origin main
# Resolver conflictos manualmente
git push origin main
```

---

### **Problema 3: "No sé qué versión está en producción"**

**Verificar en Vercel:**
1. Vercel Dashboard → Proyecto
2. Ver "Deployments" → Último deploy exitoso
3. Ver "Commit" → Copiar SHA
4. Comparar con GitHub:
   ```powershell
   git show [SHA-de-Vercel]
   ```

---

## 🔄 **WORKFLOW RECOMENDADO ANTES DE TRABAJAR**

```powershell
# 1. Landing Page
cd C:\Dev\landing-page
git pull origin master
git status  # Verificar que está limpio

# 2. Platform
cd C:\Dev\job-platform
git pull origin main
git status  # Verificar que está limpio

# 3. Hacer cambios...

# 4. Antes de commitear, verificar:
git status
git diff  # Ver qué cambiaste

# 5. Commit y push
git add .
git commit -m "Descripción del cambio"
git push origin [branch]

# 6. Verificar en GitHub que el push fue exitoso
# 7. Verificar en Vercel que se inició un nuevo deploy
```

---

## 📱 **VERIFICACIÓN RÁPIDA EN PRODUCCIÓN**

### **Desde el Navegador:**

1. **Inspeccionar la página (F12)**
2. **Ver código fuente:**
   - Ver fecha de último cambio en comentarios
   - Ver versiones de archivos JS/CSS

3. **Ver Network tab:**
   - Verificar fechas de archivos estáticos
   - Comparar con fecha del último commit

### **Comando útil:**
```javascript
// En consola del navegador (F12)
console.log('Build Time:', document.querySelector('meta[name="build-time"]')?.content);
console.log('Version:', document.querySelector('meta[name="version"]')?.content);
```

---

## ✅ **ESTADO ACTUAL (2025-11-02)**

### **Landing Page:**
- ⚠️ **3 archivos modificados sin commit:**
  - `src/components/layout/Header.tsx` (corrección signin)
  - `src/app/login/page.tsx` (corrección redirect)
  - `src/app/dashboard-redirect/page.tsx` (corrección redirect)
- 📝 **Último commit en GitHub:** 2025-08-22
- 🔄 **Necesita:** Commit y push de cambios

### **Platform:**
- ✅ Frontend: Actualizado
- ✅ Backend: Actualizado
- 📝 **Último commit:** 2025-11-02 (documentación)

---

## 🎯 **PRÓXIMOS PASOS**

1. **Commit cambios en Landing:**
   ```powershell
   cd C:\Dev\landing-page
   git add .
   git commit -m "Fix: Corregir redirect de signin a platform dashboard"
   git push origin master
   ```

2. **Verificar en Vercel:**
   - Esperar a que se complete el deploy automático
   - Verificar que los cambios están en producción

3. **Probar flujo completo:**
   - Desde Landing → Click Signin → Debe redirigir a Platform

---

**Scripts creados:**
- `C:\Dev\landing-page\verificar-version.ps1`
- `C:\Dev\job-platform\verificar-version.ps1`

**Ejecutar para verificación rápida:**
```powershell
cd C:\Dev\landing-page
.\verificar-version.ps1
```

