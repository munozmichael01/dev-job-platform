# 🔗 Cómo Obtener Connection String de Azure SQL

---

## 📋 **PASO A PASO:**

### **Opción 1: Desde la Base de Datos (Recomendado)**

1. **En Azure Portal**, buscar tu base de datos:
   - Click en el buscador superior
   - Escribir: `job-platform-db`
   - Click en la base de datos

2. **En el menú lateral izquierdo:**
   - Buscar y click: **"Connection strings"** / **"Cadenas de conexión"**
   - (Está en la sección **Settings**)

3. **Verás varias opciones:**
   - ADO.NET
   - JDBC
   - ODBC
   - PHP
   - Node.js

4. **Para tu backend (Node.js con mssql):**
   - Puedes usar **ADO.NET** o ver **Node.js**
   - **Copiar el connection string**

---

### **Opción 2: Obtener Credenciales Individuales**

**Si prefieres usar variables de entorno (más limpio):**

1. **Ir a la BD:** `job-platform-db`
2. **Settings → Connection strings**
3. O también puedes ver:
   - **Settings → Properties** para ver el nombre del servidor

4. **Anotar estos valores:**
   - **Server:** `job-platform-sql-server.database.windows.net`
   - **Database:** `job-platform-db`
   - **User:** `sqladmin` (o el que configuraste)
   - **Password:** [la que creaste al crear el servidor]

---

## 📋 **PASO 3: Ver Connection String**

**En la pantalla de Connection strings verás algo como:**

**ADO.NET:**
```
Server=tcp:job-platform-sql-server.database.windows.net,1433;Initial Catalog=job-platform-db;Persist Security Info=False;User ID=sqladmin;Password={your_password_here};MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;
```

**Node.js:**
```
Server=job-platform-sql-server.database.windows.net,1433;Database=job-platform-db;User Id=sqladmin;Password={your_password_here};Encrypt=true
```

---

## ✅ **LO QUE NECESITAS PARA RAILWAY:**

**Variables de entorno (más fácil de usar):**

```
DB_SERVER=job-platform-sql-server.database.windows.net
DB_PORT=1433
DB_DATABASE=job-platform-db
DB_USER=sqladmin
DB_PASSWORD=tu-password-aqui
```

**No necesitas el connection string completo si usas variables individuales (que es lo que hace tu código).**

---

## 🎯 **PASOS RÁPIDOS:**

1. **Azure Portal** → Buscar `job-platform-db`
2. **Settings → Connection strings**
3. **Anotar:**
   - Server name
   - Database name
   - User
   - Password (la que ya tienes)

**Ya tienes todo lo que necesitas para Railway.**

---

**¿Ya estás en la pantalla de Connection strings? ¿Qué ves ahí?**

