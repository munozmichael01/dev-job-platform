# 📥 Importar Script a Azure SQL

## ✅ **ARCHIVO VERIFICADO:**
- ✅ Tamaño: 529 MB
- ✅ Líneas: 140,039
- ✅ Contiene datos (INSERT statements)

---

## 🎯 **OPCIÓN 1: Azure Portal Query Editor (Recomendado para archivos grandes)**

### **Paso 1: Abrir Query Editor en Azure Portal**

1. **Ir a Azure Portal:** https://portal.azure.com
2. **Buscar tu BD:** `job-platform-db`
3. **Click en la BD**
4. **En el menú lateral izquierdo:**
   - Buscar **"Query editor (preview)"** o **"Query editor"**
   - Click en él

### **Paso 2: Autenticarse**

1. **Login:** `sqladmin`
2. **Password:** [tu password de Azure]
3. Click **OK**

### **Paso 3: Ejecutar Script**

⚠️ **PROBLEMA:** Query Editor tiene límite de tamaño (~100MB), tu archivo es 529MB.

**SOLUCIÓN: Ejecutar en partes**

#### **Opción A: Dividir el Script**

1. **Abrir el script en un editor de texto** (VS Code, Notepad++)
2. **Dividir en partes:**
   - Parte 1: CREATE DATABASE + tablas (primeras 1000 líneas)
   - Parte 2: INSERT Users, Clients, Connections (siguientes 5000 líneas)
   - Parte 3: INSERT JobOffers (bulk de los datos)
   - Parte 4: Resto de INSERTs

#### **Opción B: Usar SSMS (Más fácil para archivos grandes)**

---

## 🎯 **OPCIÓN 2: SQL Server Management Studio (SSMS) - RECOMENDADO**

### **Paso 1: Conectar a Azure SQL**

1. **Abrir SSMS**
2. **File → Connect Object Explorer**
3. **Configurar:**
   - **Server type:** Database Engine
   - **Server name:** `job-platform-sql-server.database.windows.net`
   - **Authentication:** SQL Server Authentication
   - **Login:** `sqladmin`
   - **Password:** [tu password]
   - **Remember password:** ✅ (opcional)
   - Click **Connect**

### **Paso 2: Seleccionar Base de Datos**

1. En **Object Explorer**, expande el servidor
2. Expande **Databases**
3. **Right click en `job-platform-db`** → **New Query**
   - O click en `job-platform-db` y luego **File → New → Query with Current Connection**

### **Paso 3: Abrir el Script**

1. **File → Open → File**
2. Navegar a: `C:\Dev\job-platform\migracion-azure.sql`
3. Click **Open**

### **Paso 4: Preparar el Script**

**IMPORTANTE:** Azure SQL no permite `CREATE DATABASE` en el script.

1. **Buscar y eliminar estas líneas al inicio:**
   ```sql
   CREATE DATABASE [JobPlatform]
   ...
   USE [JobPlatform]
   ```

2. **Reemplazar `USE [JobPlatform]` por `USE [job-platform-db]`** (si aparece)

### **Paso 5: Ejecutar Script**

⚠️ **Advertencia:** El script tiene 529 MB y 140K líneas. Puede tardar 30-60 minutos.

1. **Asegúrate de estar en la BD correcta:**
   - En el dropdown superior, selecciona `job-platform-db`

2. **Ejecutar todo el script:**
   - **F5** o Click en **Execute**

3. **Esperar:**
   - Verás el progreso en "Messages" tab
   - Puede mostrar errores menores (ignóralos si son warnings)
   - Al final debe decir: "Commands completed successfully"

---

## ⚠️ **SI HAY ERRORES:**

### **Error: "CREATE DATABASE not allowed"**
- ✅ **Solución:** Elimina las líneas `CREATE DATABASE` del script

### **Error: "File too large"**
- ✅ **Solución:** Ejecutar en partes usando el script dividido

### **Error: "Timeout"**
- ✅ **Solución:** Aumentar timeout en SSMS:
  - Tools → Options → Query Execution → SQL Server → General
  - Execution time-out: 0 (sin límite)

---

## ✅ **VERIFICAR DESPUÉS DE IMPORTAR:**

En Azure SQL, ejecutar:

```sql
USE [job-platform-db];
GO

-- Contar registros
SELECT 
    'Users' as Tabla, COUNT(*) as Registros FROM Users
UNION ALL
SELECT 'JobOffers', COUNT(*) FROM JobOffers
UNION ALL
SELECT 'Connections', COUNT(*) FROM Connections;
```

**Debe mostrar los mismos números que en local:**
- Users: 15
- JobOffers: 73,242
- Connections: 88

---

**¿Prefieres usar SSMS o Azure Portal Query Editor?**

