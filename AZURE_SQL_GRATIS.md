# 🆓 Azure SQL Database - Tier Gratuito 12 Meses

**Enlace oficial:** https://azure.microsoft.com/es-mx/pricing/free-services/

---

## ✅ **TIER GRATUITO DE AZURE SQL DATABASE:**

### **Incluido en cuenta gratuita de Azure:**

1. **Azure SQL Database (Serverless):**
   - ✅ **Hasta 10 bases de datos**
   - ✅ **100,000 segundos de núcleo virtual** (compute time)
   - ✅ **32 GB de almacenamiento** por base de datos
   - ✅ **Gratis durante 12 meses** (cuenta nueva)

2. **Cuenta gratuita de Azure:**
   - ✅ $200 crédito gratis para usar en cualquier servicio
   - ✅ Válido por 30 días
   - ✅ Después, servicios siempre gratuitos siguen gratis

---

## 🎯 **LO QUE SIGNIFICA:**

### **Para tu MVP:**
- ✅ **Puedes usar Azure SQL Database gratis 12 meses**
- ✅ **32 GB es más que suficiente** para MVP
- ✅ **Serverless se ajusta automáticamente** (paga solo cuando se usa)
- ✅ **100,000 segundos de compute** es mucho para empezar

**Ejemplo:**
- Si usas 5 horas/día de compute → ~5,400 segundos/día
- 100,000 segundos ≈ **18 días** de uso continuo
- Pero serverless se pausa cuando no se usa → dura mucho más

---

## 📋 **CÓMO REGISTRARSE:**

1. **Ir a:** https://azure.microsoft.com/es-mx/free/
2. **Click:** "Crear cuenta gratuita"
3. **Crear cuenta** con email/Google/Microsoft
4. **Verificar identidad** (teléfono/tarjeta - no se cobra)
5. **Acceder al portal:** https://portal.azure.com

---

## 🚀 **CREAR AZURE SQL DATABASE:**

Una vez tengas cuenta:

1. **Portal Azure:** https://portal.azure.com
2. **Crear recurso** → Buscar "SQL Database"
3. **Click:** "Crear"
4. **Configurar:**
   - **Subscription:** Free Trial (o la que tengas)
   - **Resource Group:** Crear nuevo
   - **Database name:** `job-platform-db`
   - **Server:** Crear nuevo servidor SQL
   - **Compute + storage:** **Serverless** (tier gratuito)
     - Min/Max vCores: 0.5 - 1
     - Auto-pause delay: 1 hora
   - **Authentication:** SQL authentication
   - **Admin login:** `sqladmin` (o el que prefieras)
   - **Password:** Crear password segura
5. **Review + Create**
6. **Esperar creación** (~2-5 minutos)

---

## 🔧 **OBTENER CONNECTION STRING:**

Después de crear la BD:

1. **Ir a:** SQL Database → Tu BD
2. **Settings → Connection strings**
3. **Copiar connection string** (ADO.NET o SQL)
4. O usar credenciales individuales:
   - **Server:** `tu-servidor.database.windows.net`
   - **Database:** `job-platform-db`
   - **User:** `sqladmin`
   - **Password:** [la que creaste]

---

## ⚠️ **NOTAS IMPORTANTES:**

1. **Firewall:** Por defecto bloquea conexiones externas
   - Ir a: Settings → Firewall rules
   - Agregar: Allow Azure services = YES
   - Para Railway: Agregar IP pública de Railway (o 0.0.0.0 - 255.255.255.255 temporalmente)

2. **Serverless Auto-pause:**
   - Se pausa después de 1 hora sin actividad
   - Primera conexión después de pausa tarda ~30 segundos
   - Para producción, considerar tier básico (pago)

3. **Límite de 12 meses:**
   - Después de 12 meses, si pasas límites, pagas solo lo usado
   - Serverless = pagas solo compute time usado

---

## ✅ **VARIABLES PARA RAILWAY:**

Cuando tengas la BD creada:

```
DB_SERVER=tu-servidor.database.windows.net
DB_PORT=1433
DB_DATABASE=job-platform-db
DB_USER=sqladmin
DB_PASSWORD=[tu-password]
```

---

## 📊 **COMPARACIÓN:**

| Aspecto | Azure SQL (Gratis) | Azure SQL (Después 12m) |
|---------|-------------------|------------------------|
| **Costo primeros 12m** | $0 | $0 (dentro de límites) |
| **Storage** | 32 GB gratis | 32 GB gratis |
| **Compute** | 100K segundos/mes | Pagas lo usado |
| **Auto-pause** | ✅ Sí | ✅ Sí |
| **Para MVP** | ✅ Perfecto | ⚠️ Revisar uso |

---

## 🎯 **RECOMENDACIÓN:**

✅ **Sí, usar Azure SQL Database tier gratuito para MVP:**
- Gratis 12 meses
- Suficiente para MVP
- Compatible 100% con tu código
- Fácil migración después si es necesario

---

**Enlaces útiles:**
- **Crear cuenta gratuita:** https://azure.microsoft.com/es-mx/free/
- **Servicios gratuitos:** https://azure.microsoft.com/es-mx/pricing/free-services/
- **Portal Azure:** https://portal.azure.com
- **Documentación SQL Database:** https://docs.microsoft.com/azure/azure-sql/database/

---

**¿Quieres que te guíe paso a paso para crear la BD en Azure?**

