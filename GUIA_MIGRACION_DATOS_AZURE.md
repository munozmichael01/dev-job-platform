# 🗄️ Guía Completa: Migrar Datos de SQL Server Local a Azure SQL

**Fecha:** 2025-11-02

---

## 📋 **PREREQUISITOS:**

- ✅ SQL Server Management Studio (SSMS) instalado
- ✅ Conexión a tu BD local funcionando
- ✅ Azure SQL Database creada
- ✅ Credenciales de Azure SQL

---

## 🎯 **PASO 1: Verificar Datos en BD Local**

### **1.1 Conectar a BD Local en SSMS**

**Según la documentación del proyecto:**

1. Abrir **SQL Server Management Studio**
2. Conectar a tu servidor local:
   - **Server name:** `localhost` (o `localhost\SQLEXPRESS` si usas Express)
   - **Authentication:** Windows Authentication o SQL Server Authentication
   - Click **Connect**

**Configuración según documentación:**
- **Database name:** `JobPlatform` (default según `backend/src/db/db.js`)
- **Server:** `localhost`
- **Port:** `1433` (default SQL Server)

### **1.2 Verificar Qué Datos Tienes**

**Primero, asegúrate de estar en la BD correcta:**

```sql
USE JobPlatform;
GO
```

**Luego, ejecutar estas queries para ver qué hay:**

```sql
-- Ver todas las tablas
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;

-- Contar registros por tabla (tablas principales según código)
SELECT 
    'Users' as Tabla, COUNT(*) as Registros FROM Users
UNION ALL
SELECT 'Clients', COUNT(*) FROM Clients
UNION ALL
SELECT 'ClientConnections', COUNT(*) FROM ClientConnections
UNION ALL
SELECT 'JobOffers', COUNT(*) FROM JobOffers
UNION ALL
SELECT 'Campaigns', COUNT(*) FROM Campaigns
UNION ALL
SELECT 'Segments', COUNT(*) FROM Segments;
```

**Anotar:**
- ¿Cuántas tablas tienes?
- ¿Cuántos registros en cada una?

---

## 📋 **PASO 2: Exportar Datos desde BD Local**

### **Método Recomendado: Generate Scripts (Solo Esquema + Datos)**

**Este método es el más seguro y fácil:**

1. **En SSMS, conectar a tu BD local**

2. **Right click en tu BD** (ej: `JobPlatform`)
   - **Tasks → Generate Scripts...**

3. **Welcome Screen:**
   - Click **Next**

4. **Choose Objects:**
   - ✅ Seleccionar: **"Script entire database and all database objects"**
   - O si prefieres: **"Select specific database objects"** y marcar las tablas que necesitas
   - **Asegúrate de seleccionar la BD `JobPlatform`** (según documentación)
   - Click **Next**

5. **Set Scripting Options:**
   - **File to save to:** Elegir carpeta y nombre (ej: `C:\Dev\job-platform\migracion-azure.sql`)
   - **Advanced Scripting Options** → Click "Advanced":
     - **Types of data to script:** Cambiar a **"Schema and data"** (importante!)
     - **Script Indexes:** True
     - **Script Foreign Keys:** True
     - **Script Check Constraints:** True
   - Click **OK** → **Next**

6. **Summary:**
   - Revisar qué se va a exportar
   - Click **Next**

7. **Save or Publish:**
   - Click **Finish**
   - Esperar a que genere el script (puede tardar varios minutos)
   - Click **Close**

---

## 📋 **PASO 3: Preparar Script para Azure SQL**

### **3.1 Ajustar Script (Si es Necesario)**

El script generado puede tener algunas cosas que no funcionan en Azure:

**Cambios comunes:**

1. **Eliminar `USE [DatabaseName]`** - Azure SQL no permite cambiar BD en el script
2. **Reemplazar `GO` por `;`** - O simplemente ejecutar sección por sección

**Pero primero, prueba tal cual está - Azure SQL es muy compatible con SQL Server.**

---

## 📋 **PASO 4: Conectar a Azure SQL en SSMS**

### **4.1 Nueva Conexión**

1. En SSMS, click **File → Connect Object Explorer**
2. Configurar conexión:
   - **Server type:** Database Engine
   - **Server name:** `job-platform-sql-server.database.windows.net`
   - **Authentication:** SQL Server Authentication
   - **Login:** `sqladmin`
   - **Password:** [tu password de Azure]
   - **Remember password:** ✅ (opcional)
   - Click **Connect**

3. Si conecta ✅ = Firewall está bien
Si falla → Verificar firewall en Azure Portal

### **4.2 Verificar que la BD Está Vacía**

```sql
-- Verificar tablas (debe estar vacío o no existir)
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE';
```

---

## 📋 **PASO 5: Importar Esquema y Datos a Azure SQL**

### **Opción A: Usar Query Editor de Azure Portal (Más Fácil)**

1. **Azure Portal → `job-platform-db`**
2. **Query editor** (menú lateral izquierdo)
3. **Iniciar sesión:**
   - Login: `sqladmin`
   - Password: [tu password]
4. **Pegar el script SQL** que generaste
5. **Ejecutar** (puede tardar varios minutos si hay muchos datos)

### **Opción B: Usar SSMS**

1. **Conectar a Azure SQL** (paso 4)
2. **Abrir el archivo SQL** que generaste:
   - File → Open → File → Seleccionar `migracion-azure.sql`
3. **Seleccionar la BD** en el dropdown superior:
   - Click en el dropdown y seleccionar `job-platform-db`
4. **Ejecutar script:**
   - Click **Execute** (F5)
   - Esperar a que termine (puede tardar)

⚠️ **Si hay errores con `GO`:**
- Ejecutar sección por sección
- O usar Azure Query Editor que maneja esto mejor

---

## 📋 **PASO 6: Verificar Migración**

### **6.1 Verificar Tablas Creadas**

En Azure SQL, ejecutar:

```sql
SELECT TABLE_NAME 
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;
```

**Debe mostrar las mismas tablas que tenías en local.**

### **6.2 Verificar Conteo de Registros**

```sql
-- Comparar con lo que tenías en local
SELECT 
    'Users' as Tabla, COUNT(*) as Registros FROM Users
UNION ALL
SELECT 'Clients', COUNT(*) FROM Clients
UNION ALL
SELECT 'ClientConnections', COUNT(*) FROM ClientConnections
UNION ALL
SELECT 'JobOffers', COUNT(*) FROM JobOffers
UNION ALL
SELECT 'Campaigns', COUNT(*) FROM Campaigns
UNION ALL
SELECT 'Segments', COUNT(*) FROM Segments;
```

**Debe coincidir con los números de tu BD local.**

### **6.3 Verificar Datos Específicos**

```sql
-- Ver usuarios
SELECT TOP 10 * FROM Users;

-- Ver ofertas
SELECT TOP 10 * FROM JobOffers;

-- Ver campañas
SELECT * FROM Campaigns;
```

---

## 📋 **PASO 7: Si Hay Errores Durante Migración**

### **Error Común 1: "Invalid object name"**

**Causa:** Tabla referenciada antes de ser creada.

**Solución:** Ejecutar el script en orden correcto, o ejecutar sección por sección.

---

### **Error Común 2: "Foreign key constraint"**

**Causa:** Intentando insertar datos que violan foreign keys.

**Solución:** 
1. Deshabilitar temporalmente constraints
2. Insertar datos
3. Habilitar constraints

---

### **Error Común 3: "Login failed"**

**Causa:** Firewall no permite tu IP.

**Solución:** Agregar tu IP en Azure Portal → SQL Server → Firewall rules.

---

## ✅ **CHECKLIST MIGRACIÓN:**

- [ ] BD local conectada en SSMS
- [ ] Datos verificados y contados
- [ ] Script SQL generado
- [ ] Conexión a Azure SQL probada
- [ ] Script ejecutado en Azure SQL
- [ ] Tablas creadas verificadas
- [ ] Conteo de registros verificado
- [ ] Datos específicos verificados
- [ ] Sin errores en logs

---

## 🎯 **DESPUÉS DE MIGRAR:**

1. ✅ Backend puede conectarse a Azure SQL
2. ✅ Todas las tablas existen
3. ✅ Datos están ahí
4. ✅ Puedes desplegar backend en Railway

---

**¿En qué paso estás? ¿Ya tienes SSMS instalado y conectado a tu BD local?**

