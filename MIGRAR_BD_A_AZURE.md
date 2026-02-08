# 🚀 Migrar BD Local a Azure SQL y Conectar al Proyecto

**Fecha:** 2025-11-02

---

## 📋 **PASO 1: Obtener Connection String de Azure**

### **1.1 Ir al Recurso Creado**

1. En Azure Portal, click en **"Go to resource"** / **"Ir al recurso"**
2. O busca en "All resources" → `job-platform-db`

### **1.2 Obtener Connection String**

1. En el menú lateral izquierdo: **Settings → Connection strings**
2. Buscar la sección **"ADO.NET"**
3. **Copiar el connection string** (algo como):
   ```
   Server=tcp:job-platform-sql-server.database.windows.net,1433;Initial Catalog=job-platform-db;Persist Security Info=False;User ID=sqladmin;Password={tu-password};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
   ```

4. **O anotar credenciales individuales:**
   - **Server:** `job-platform-sql-server.database.windows.net`
   - **Database:** `job-platform-db`
   - **User:** `sqladmin`
   - **Password:** [la que creaste]

---

## 📋 **PASO 2: Configurar Firewall para Permitir Tu PC**

### **2.1 Agregar Tu IP Actual**

1. En Azure Portal, buscar el **SQL Server** (no la BD):
   - Buscar: `job-platform-sql-server`
2. Click en el servidor
3. **Settings → Networking** o **Firewall rules**
4. Verificar que:
   - ✅ "Allow Azure services and resources" está en **Yes**
   - ✅ Tu IP actual está agregada
5. Si no está tu IP, agregarla:
   - Click **"Add client IP"** / **"Agregar IP del cliente"**

---

## 📋 **PASO 3: Migrar Datos (Si Tienes Datos Importantes)**

### **Opción A: SQL Server Management Studio (SSMS) - Recomendado**

**Si tienes datos que migrar:**

1. **Abrir SQL Server Management Studio** (si lo tienes instalado)
2. **Conectar a Azure SQL:**
   - Server name: `job-platform-sql-server.database.windows.net`
   - Authentication: SQL Server Authentication
   - Login: `sqladmin`
   - Password: [tu password]
   - Database: `job-platform-db`
   - Click "Connect"

3. **Exportar datos desde BD local:**
   - Right click en tu BD local → Tasks → Export Data
   - Or usar scripts SQL

4. **Importar a Azure SQL:**
   - Ejecutar scripts en Azure SQL
   - O usar Import Data Wizard

### **Opción B: Empezar Vacío (Recomendado para MVP si BD está vacía o casi vacía)**

**Si no tienes datos importantes o quieres empezar limpio:**

1. **Solo necesitas el esquema** (tablas, no datos)
2. **Crear esquema en Azure:**
   - Ir a Azure Portal → `job-platform-db`
   - **Query editor** (menú lateral)
   - O usar SQL Server Management Studio
   - Ejecutar scripts de creación de tablas

### **Opción C: Usar Scripts SQL**

**Si tienes scripts de creación:**

1. **Conectar a Azure SQL** (SSMS o Query Editor)
2. **Ejecutar tus scripts** de creación de tablas
3. **Opcional:** Importar datos con INSERT statements

---

## 📋 **PASO 4: Probar Conexión desde Tu PC**

### **4.1 Probar con SQL Server Management Studio**

1. Abrir SSMS
2. Conectar:
   - Server: `job-platform-sql-server.database.windows.net`
   - Auth: SQL Server Authentication
   - Login: `sqladmin`
   - Password: [tu password]
3. Si conecta ✅ = Firewall está bien

### **4.2 O Probar con tu Código**

Temporalmente cambiar `backend/src/db/db.js` para probar:

```javascript
// Temporal - solo para probar
const config = {
  server: 'job-platform-sql-server.database.windows.net',
  port: 1433,
  database: 'job-platform-db',
  user: 'sqladmin',
  password: 'tu-password-aqui',
  options: {
    encrypt: true, // IMPORTANTE: Azure requiere SSL
    trustServerCertificate: false
  }
};
```

---

## 📋 **PASO 5: Desplegar Backend en Railway**

### **5.1 Crear Proyecto en Railway**

1. Ir a: https://railway.app
2. **Sign up** con GitHub
3. **New Project** → Deploy from GitHub repo
4. Seleccionar: `dev-job-platform`
5. Click en el servicio creado

### **5.2 Configurar Root Directory**

1. En Railway, Settings → Source
2. **Root Directory:** `backend`
3. Guardar

### **5.3 Agregar Variables de Entorno**

1. **Settings → Variables**
2. Agregar estas variables:

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

3. **Save** → Railway hará deploy automático

### **5.4 Obtener URL del Backend**

Después del deploy:
1. Railway Dashboard → Tu servicio
2. **Settings → Networking**
3. Ver **Public Domain**
4. URL será: `https://tu-proyecto.up.railway.app`

---

## 📋 **PASO 6: Configurar Firewall de Azure para Railway**

### **6.1 Agregar IP de Railway**

1. Azure Portal → SQL Server `job-platform-sql-server`
2. **Settings → Networking** / **Firewall rules**
3. **Agregar regla:**
   - **Rule name:** `Railway`
   - **Start IP:** `0.0.0.0`
   - **End IP:** `255.255.255.255`
   - ⚠️ **Temporal:** Esto permite desde cualquier IP
   - Para producción después, solo IPs específicas de Railway
4. **Save**

---

## 📋 **PASO 7: Configurar Variables en Vercel (Platform Frontend)**

### **7.1 Agregar NEXT_PUBLIC_API_URL**

1. Vercel Dashboard → Proyecto `dev-job-platform`
2. **Settings → Environment Variables**
3. Agregar:
   ```
   NEXT_PUBLIC_API_URL=https://tu-backend.up.railway.app
   NEXT_PUBLIC_LANDING_URL=https://tu-landing.vercel.app
   ```
4. **Save** → Vercel hará redeploy

---

## ✅ **CHECKLIST FINAL**

- [ ] Azure SQL Database creada ✅
- [ ] Connection string obtenido
- [ ] Firewall configurado (tu IP + Railway)
- [ ] Datos migrados (o esquema creado)
- [ ] Conexión probada desde tu PC
- [ ] Backend desplegado en Railway
- [ ] Variables de entorno configuradas en Railway
- [ ] URL del backend obtenida
- [ ] Variables configuradas en Vercel (Platform)
- [ ] Todo funcionando end-to-end

---

## 🆘 **SI HAY PROBLEMAS**

### **Error: "Cannot connect to server"**
- Verificar firewall en Azure
- Verificar que Server name es correcto
- Verificar que `encrypt: true` en conexión

### **Error: "Login failed"**
- Verificar usuario/password
- Verificar que el usuario existe en Azure SQL

### **Error: "Timeout"**
- Verificar que el servidor no está pausado (serverless)
- Primera conexión después de pausa tarda ~30 segundos

---

**¿En qué paso estás? ¿Tienes datos que migrar o empezamos vacío?**

