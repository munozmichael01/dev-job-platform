# 📋 Pasos Concretos: Migrar BD y Conectar a Azure

---

## 🎯 **RESUMEN DE PASOS:**

1. ✅ Obtener credenciales de Azure SQL
2. ⏳ Configurar firewall en Azure
3. ⏳ Migrar datos (si tienes) o crear esquema vacío
4. ⏳ Desplegar backend en Railway
5. ⏳ Configurar variables en Railway
6. ⏳ Configurar variables en Vercel

---

## 📋 **PASO 1: Obtener Credenciales de Azure SQL**

### **Desde Azure Portal:**

1. **Buscar tu BD:** `job-platform-db`
2. Click en la BD
3. **Settings → Connection strings**
4. Anotar:
   - **Server:** `job-platform-sql-server.database.windows.net`
   - **Database:** `job-platform-db`
   - **User:** `sqladmin`
   - **Password:** [la que creaste]

---

## 📋 **PASO 2: Configurar Firewall**

### **En Azure Portal:**

1. **Buscar el SERVIDOR SQL** (no la BD): `job-platform-sql-server`
2. Click en el servidor
3. **Settings → Networking** o **Firewall rules**
4. Verificar:
   - ✅ "Allow Azure services" = **Yes**
   - ✅ Tu IP está agregada
5. **Agregar regla para Railway:**
   - Click "Add client IP" o "Add firewall rule"
   - Name: `Railway`
   - Start IP: `0.0.0.0`
   - End IP: `255.255.255.255`
   - **Save**

⚠️ Esto permite desde cualquier IP (OK para MVP, cambiar después)

---

## 📋 **PASO 3: Migrar Datos**

### **¿Tienes datos importantes en tu BD local?**

**Si SÍ:**
- Usar SQL Server Management Studio para exportar/importar
- O scripts SQL

**Si NO (recomendado para MVP):**
- Empezar vacío en Azure
- El código creará las tablas automáticamente cuando se conecte
- O ejecutar scripts de creación manualmente

---

## 📋 **PASO 4: Desplegar Backend en Railway**

### **4.1 Crear Proyecto:**

1. Ir a: https://railway.app
2. **Sign up** con GitHub (si no tienes cuenta)
3. **New Project** → Deploy from GitHub repo
4. Seleccionar: `dev-job-platform`
5. Click en el servicio creado

### **4.2 Configurar:**

1. **Settings → Source**
   - **Root Directory:** `backend`
   - **Save**

2. **Settings → Variables** → Agregar:

```
DB_SERVER=job-platform-sql-server.database.windows.net
DB_PORT=1433
DB_DATABASE=job-platform-db
DB_USER=sqladmin
DB_PASSWORD=tu-password-de-azure
JWT_SECRET=tu-jwt-secret-super-seguro
ALLOWED_ORIGINS=https://dev-job-platform.vercel.app,https://tu-landing.vercel.app
PORT=3002
```

3. **Save** → Railway inicia deploy automático

### **4.3 Obtener URL:**

Después del deploy:
- Railway Dashboard → Settings → Networking
- Ver **Public Domain**
- URL: `https://tu-proyecto.up.railway.app`

---

## 📋 **PASO 5: Configurar Vercel (Platform Frontend)**

1. Vercel Dashboard → `dev-job-platform`
2. **Settings → Environment Variables**
3. Agregar:
   ```
   NEXT_PUBLIC_API_URL=https://tu-backend.up.railway.app
   ```
4. **Save** → Redeploy automático

---

**¿Tienes datos que migrar o empezamos vacío en Azure?**

