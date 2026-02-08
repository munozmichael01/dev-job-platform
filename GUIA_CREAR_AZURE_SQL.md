# 🚀 Guía Paso a Paso: Crear Azure SQL Database

**Desde:** Portal Azure → Azure SQL → SQL databases

---

## 📋 **PASO 1: Refrescar o Ir a Crear Recurso**

**Opción A: Si ves el error de token:**
- Click en **"Simplified View"** (botón en el error banner)
- O simplemente refresca la página (F5)

**Opción B: Ir directo a crear:**
1. En la parte superior, busca el botón **"Create"** o **"Crear"**
2. O busca en la barra superior: **"+ Create"** / **"+ Crear"**

---

## 📋 **PASO 2: Buscar y Crear SQL Database**

1. En la barra superior de Azure, busca: **"SQL Database"**
2. Selecciona: **"SQL Database"** (no Managed Instance)
3. Click en **"Create"** / **"Crear"**

---

## 📋 **PASO 3: Configurar Básico (Tab 1)**

### **Project details:**
- **Subscription:** Deja la que tienes seleccionada (o "Free Trial" si aparece)
- **Resource Group:** 
  - Click "Create new" / "Crear nuevo"
  - Nombre: `job-platform-rg`
  - Click "OK"

### **Database details:**
- **Database name:** `job-platform-db`
- **Server:** Click "Create new" / "Crear nuevo"
  - **Server name:** `job-platform-sql-server` (debe ser único global)
  - **Location:** La más cercana (ej: "West Europe" o "East US")
  - **Authentication method:** SQL authentication
  - **Server admin login:** `sqladmin` (o el que prefieras)
  - **Password:** Crear password segura (GUARDARLA - la necesitarás)
  - **Confirm password:** Misma password
  - Click "OK"

---

## 📋 **PASO 4: Configurar Compute + Storage (Tab 2)**

**IMPORTANTE: Seleccionar tier SERVERLESS para gratis**

1. **Compute tier:** Seleccionar **"Serverless"**
2. **Configure serverless:**
   - **Min vCores:** `0.5`
   - **Max vCores:** `1` (o dejar por defecto)
   - **Auto-pause delay:** `1 hour` (para ahorrar compute time)
3. **Storage:**
   - Dejar por defecto (32 GB incluido en tier gratuito)
4. **Backup storage redundancy:** `Locally-redundant` (más barato)

---

## 📋 **PASO 5: Networking (Tab 3)**

**IMPORTANTE: Permitir conexiones desde Railway**

1. **Network connectivity:**
   - **Connectivity method:** Seleccionar **"Public endpoint"**
   
2. **Firewall rules:**
   - ✅ **Allow Azure services and resources to access this server:** **YES** / **SÍ**
   - ✅ **Add current client IP address:** **YES** / **SÍ**
   - Para Railway: Agregar regla después (o temporalmente permitir todo: 0.0.0.0 - 255.255.255.255)

3. **Connection policy:** Dejar por defecto

---

## 📋 **PASO 6: Security (Tab 4)**

- Dejar todo por defecto (por ahora)
- Microsoft Defender: Opcional (puedes desactivar para MVP)

---

## 📋 **PASO 7: Additional settings (Tab 5)**

1. **Use existing data:**
   - **Source:** `None` (empezar vacía) o "Backup" si tienes backup

2. **Database collation:** Dejar por defecto (`SQL_Latin1_General_CP1_CI_AS`)

---

## 📋 **PASO 8: Review + Create**

1. Click **"Review + create"** / **"Revisar y crear"**
2. Revisar configuración
3. Click **"Create"** / **"Crear"**
4. Esperar ~2-5 minutos mientras se crea

---

## ✅ **PASO 9: Obtener Connection String**

Una vez creada la BD:

1. Click en **"Go to resource"** / **"Ir al recurso"**
2. En el menú lateral izquierdo:
   - **Settings → Connection strings**
3. Copiar **ADO.NET** connection string
4. O anotar credenciales individuales:
   - **Server:** `job-platform-sql-server.database.windows.net`
   - **Database:** `job-platform-db`
   - **User:** `sqladmin`
   - **Password:** [la que creaste]

---

## ⚠️ **CONFIGURAR FIREWALL PARA RAILWAY**

Después de crear la BD:

1. En el servidor SQL (no la BD):
   - Ir a: **SQL Server** → `job-platform-sql-server`
2. **Security → Firewall rules**
3. Agregar regla:
   - **Rule name:** `Railway`
   - **Start IP:** `0.0.0.0`
   - **End IP:** `255.255.255.255`
   - **Save**
   
   **⚠️ NOTA:** Esto permite conexiones desde cualquier IP. Para producción, solo agregar IPs específicas de Railway.

---

## 📝 **VARIABLES PARA RAILWAY (Después)**

```
DB_SERVER=job-platform-sql-server.database.windows.net
DB_PORT=1433
DB_DATABASE=job-platform-db
DB_USER=sqladmin
DB_PASSWORD=[tu-password]
```

---

**¿En qué paso estás? Si hay algún problema, dime qué ves en pantalla.**

