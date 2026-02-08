# 🗄️ Migrar BD Local a Azure SQL

**Fecha:** 2025-11-02

---

## 🎯 **OPCIONES SEGÚN TU SITUACIÓN:**

### **Opción A: Empezar Vacío en Azure (Recomendado para MVP)**

**Si NO tienes datos importantes o quieres empezar limpio:**

✅ **El código crea las tablas automáticamente** cuando el backend se conecta por primera vez.

**Ventajas:**
- ✅ Cero trabajo manual
- ✅ Esquema siempre actualizado
- ✅ Sin problemas de migración

**Cómo funciona:**
- Tu código tiene `bootstrap.js` que crea tablas si no existen
- Cuando despliegues backend en Railway y conecte a Azure SQL, creará todo automáticamente

---

### **Opción B: Migrar Datos Existentes**

**Si SÍ tienes datos importantes que necesitas conservar:**

**Pasos:**

1. **Exportar desde BD Local**
2. **Importar a Azure SQL**
3. **Verificar datos**

---

## 📋 **OPCIÓN A: Empezar Vacío (Más Fácil)**

### **Solo necesitas:**

1. **Desplegar backend en Railway** con variables de Azure SQL
2. **El backend creará las tablas automáticamente** al conectarse
3. **Listo** ✅

**No necesitas hacer nada manual con SQL.**

---

## 📋 **OPCIÓN B: Migrar Datos (Si Tienes Datos Importantes)**

### **Paso 1: Exportar desde BD Local**

**Método 1: SQL Server Management Studio (SSMS)**

1. Abrir SSMS
2. Conectar a tu BD local: `localhost\SQLEXPRESS` o similar
3. **Right click en tu BD** → Tasks → Export Data-tier Application
4. Guardar como `.bacpac` o `.dacpac`

**Método 2: Scripts SQL**

1. En SSMS: Right click en BD → Tasks → Generate Scripts
2. Seleccionar todas las tablas
3. Generar script SQL
4. Guardar archivo `.sql`

---

### **Paso 2: Importar a Azure SQL**

**Opción 1: Azure Portal**

1. Azure Portal → `job-platform-db`
2. **Query editor** (menú lateral)
3. Pegar y ejecutar scripts SQL

**Opción 2: SQL Server Management Studio**

1. Abrir SSMS
2. Conectar a Azure SQL:
   - Server: `job-platform-sql-server.database.windows.net`
   - Authentication: SQL Server Authentication
   - Login: `sqladmin`
   - Password: [tu password]
3. **Ejecutar scripts SQL** que generaste
4. O usar **Import Data Wizard**

---

### **Paso 3: Verificar Datos**

1. En Azure Portal → Query editor
2. Ejecutar: `SELECT COUNT(*) FROM Users`
3. Verificar que los datos están ahí

---

## 🎯 **RECOMENDACIÓN:**

### **Para MVP:**
✅ **Opción A: Empezar Vacío**

**Razones:**
- Más rápido (0 minutos vs 1-2 horas)
- Sin problemas de migración
- El código crea todo automáticamente
- Puedes crear usuarios nuevos desde la app

**Si después necesitas migrar datos, puedes hacerlo cuando tengas tiempo.**

---

### **Si Tienes Datos Críticos:**
⏳ **Opción B: Migrar Ahora**

**Solo si:**
- Tienes usuarios/productos/datos importantes
- No puedes empezar sin esos datos
- Vale la pena perder tiempo migrando

---

## ❓ **PREGUNTA IMPORTANTE:**

**¿Tienes datos importantes en tu BD local?**
- Si NO → **Opción A** (empezar vacío) ✅
- Si SÍ → **Opción B** (migrar datos) ⏳

---

**¿Qué prefieres hacer? ¿Tienes datos importantes o empezamos vacío?**

