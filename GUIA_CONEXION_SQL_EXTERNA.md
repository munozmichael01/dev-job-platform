# 🔌 Guía: Conexión a Base de Datos SQL Externa

## 📋 Resumen Ejecutivo

Esta guía detalla cómo implementar un nuevo tipo de conexión **"SQL Database"** para importar ofertas desde una base de datos SQL Server externa, considerando las diferencias entre desarrollo (acceso vía VPN local) y producción (acceso directo o bastion host).

---

## 🎯 Objetivos

1. Agregar tipo de conexión `"SQL"` al sistema existente
2. Almacenar credenciales de BD de forma encriptada (usando `CredentialsManager`)
3. Manejar diferencias entre desarrollo (VPN) y producción
4. Seguir el patrón de procesadores existentes (XMLProcessor, APIProcessor)
5. Implementar detección automática de campos y mapeo

---

## 🏗️ Arquitectura Propuesta

### **Patrón Actual (XML, API):**
```
Frontend → Backend → Processor → External Source → JobOffers (BD Local)
```

### **Nuevo Patrón (SQL Database):**
```
Frontend → Backend → SQLProcessor → External SQL Server (via VPN/Direct) → JobOffers (BD Local)
```

### **Flujo de Datos:**
```
1. Usuario crea conexión tipo "SQL" en Frontend
2. Credenciales se almacenan encriptadas en UserChannelCredentials (o nueva tabla)
3. Al sincronizar, SQLProcessor:
   - Desencripta credenciales
   - Conecta a BD externa (puede requerir VPN en dev)
   - Ejecuta query configurada
   - Transforma resultados a formato JobOffers
   - Inserta en BD local
```

---

## 🔐 **SEGURIDAD: Desarrollo vs Producción**

### **🔴 DESARROLLO (Local con VPN)**

**Características:**
- Acceso solo desde tu ordenador vía VPN
- BD externa no accesible desde servidor de desarrollo
- Requiere VPN activa para funcionar

**Implementación:**
```javascript
// Opción 1: Validar que VPN está activa (check de conectividad)
// Opción 2: Asumir que si el servidor puede conectarse, VPN está activa
// Opción 3: Usar variables de entorno para indicar modo desarrollo
```

**Variables de Entorno:**
```env
# .env.development
NODE_ENV=development
EXTERNAL_DB_REQUIRE_VPN=true
EXTERNAL_DB_VPN_CHECK_ENABLED=true
```

**Configuración:**
- Credenciales almacenadas encriptadas (igual que producción)
- Timeout más largo (puede ser lento vía VPN)
- Logging más detallado para debugging

---

### **🟢 PRODUCCIÓN (Sin VPN, Acceso Directo)**

**Características:**
- Servidor en cloud puede conectarse directamente
- Sin VPN necesaria
- Posiblemente con bastion host o IP whitelist

**Implementación:**
```javascript
// Validar conectividad directa
// Usar credenciales encriptadas desde BD
// Timeout estándar
// Logging mínimo (solo errores críticos)
```

**Variables de Entorno:**
```env
# .env.production
NODE_ENV=production
EXTERNAL_DB_REQUIRE_VPN=false
EXTERNAL_DB_VPN_CHECK_ENABLED=false
```

**Configuración:**
- Credenciales almacenadas encriptadas
- Timeout estándar
- Logging de seguridad (sin exponer credenciales)
- Rate limiting para prevenir abuso

---

## 📝 **IMPLEMENTACIÓN PASO A PASO**

### **Paso 1: Actualizar Tabla Connections**

**Agregar campo para tipo SQL (si no existe):**
```sql
-- Ya debería soportar "SQL" si type es VARCHAR
-- Verificar si necesitamos agregar campos adicionales:
-- - Query: SQL query para obtener ofertas
-- - TableName: Tabla principal
-- - DatabaseName: Nombre de la BD
```

**Ejemplo de conexión en BD:**
```javascript
{
  id: 1,
  name: "BD Externa - Ofertas Cliente",
  type: "SQL",  // NUEVO TIPO
  url: null,    // No usado para SQL
  frequency: "daily",
  status: "active",
  UserId: 123,
  // Campos específicos SQL (en JSON en Notes o nueva columna):
  Notes: JSON.stringify({
    server: "sql-externo.ejemplo.com",
    database: "OfertasDB",
    query: "SELECT * FROM JobOffers WHERE Status = 'Active'",
    // Credenciales NO van aquí - van en UserChannelCredentials encriptadas
  })
}
```

---

### **Paso 2: Crear SQLProcessor**

**Archivo:** `backend/src/processors/sqlProcessor.js`

```javascript
const sql = require('mssql');
const { pool, sql: localSql } = require('../db/db');
const { updateOfferStatusByGoals } = require('../utils/statusUpdater');
const CredentialsManager = require('../services/credentialsManager');

class SQLProcessor {
  constructor(connection) {
    this.connection = connection;
    this.credentialsManager = new CredentialsManager();
    console.log("🔧 SQLProcessor initialized for connection:", connection.id);
  }

  /**
   * Obtiene credenciales desencriptadas de la conexión
   */
  async getCredentials() {
    try {
      // Las credenciales SQL se almacenan en UserChannelCredentials
      // Usamos un "canal" especial para conexiones SQL: "sql_external"
      const credentials = await this.credentialsManager.getUserChannelCredentials(
        this.connection.UserId,
        `sql_${this.connection.id}` // Canal único por conexión SQL
      );

      if (!credentials) {
        throw new Error('Credenciales SQL no encontradas. Configure las credenciales primero.');
      }

      return {
        server: credentials.server || credentials.host,
        database: credentials.database || credentials.db,
        user: credentials.user || credentials.username,
        password: credentials.password,
        port: credentials.port || 1433,
        options: {
          encrypt: credentials.encrypt !== false, // true por defecto
          trustServerCertificate: credentials.trustServerCertificate || false,
          enableArithAbort: true,
          ...credentials.options
        }
      };
    } catch (error) {
      console.error('❌ Error obteniendo credenciales SQL:', error);
      throw new Error('No se pudieron obtener credenciales de la conexión SQL');
    }
  }

  /**
   * Obtiene configuración SQL de la conexión
   */
  getSQLConfig() {
    try {
      const notes = this.connection.Notes || this.connection.notes;
      if (!notes) {
        throw new Error('Configuración SQL no encontrada en conexión');
      }

      return JSON.parse(notes);
    } catch (error) {
      console.error('❌ Error parseando configuración SQL:', error);
      throw new Error('Configuración SQL inválida');
    }
  }

  /**
   * Verifica conectividad a BD externa
   */
  async testConnection() {
    try {
      const credentials = await this.getCredentials();
      const sqlConfig = this.getSQLConfig();

      // En desarrollo, validar VPN si está configurado
      if (process.env.EXTERNAL_DB_VPN_CHECK_ENABLED === 'true') {
        await this.validateVPNConnection(credentials.server);
      }

      const config = {
        server: credentials.server,
        database: credentials.database || sqlConfig.database,
        user: credentials.user,
        password: credentials.password,
        port: credentials.port || 1433,
        connectionTimeout: 10000,
        requestTimeout: 30000,
        options: credentials.options
      };

      const externalPool = new sql.ConnectionPool(config);
      await externalPool.connect();
      await externalPool.close();

      return { success: true, message: 'Conexión exitosa' };
    } catch (error) {
      console.error('❌ Error en test de conexión:', error);
      return { 
        success: false, 
        message: error.message,
        code: error.code
      };
    }
  }

  /**
   * Valida que VPN está activa (solo desarrollo)
   */
  async validateVPNConnection(server) {
    const dns = require('dns').promises;
    try {
      // Intentar resolver DNS - si falla, VPN probablemente no está activa
      await dns.lookup(server, { timeout: 5000 });
      console.log('✅ VPN check: Servidor resuelto correctamente');
    } catch (error) {
      throw new Error(
        `No se puede resolver el servidor ${server}. ` +
        `Verifique que la VPN esté activa (solo desarrollo).`
      );
    }
  }

  /**
   * Detecta campos disponibles en la tabla de BD externa
   */
  async detectFields() {
    try {
      console.log("🔍 Detecting fields from SQL Database...");

      const credentials = await this.getCredentials();
      const sqlConfig = this.getSQLConfig();
      
      // Query para obtener estructura de tabla
      const tableName = sqlConfig.tableName || 'JobOffers';
      const detectQuery = `
        SELECT TOP 1 *
        FROM ${tableName}
        WHERE 1=0
      `;

      // Conectar a BD externa
      const externalConfig = {
        server: credentials.server,
        database: credentials.database || sqlConfig.database,
        user: credentials.user,
        password: credentials.password,
        port: credentials.port || 1433,
        options: credentials.options
      };

      const externalPool = new sql.ConnectionPool(externalConfig);
      await externalPool.connect();

      try {
        // Ejecutar query para obtener metadatos
        const result = await externalPool.request().query(detectQuery);
        
        // Obtener una fila de muestra real
        const sampleQuery = sqlConfig.query || `SELECT TOP 1 * FROM ${tableName}`;
        const sampleResult = await externalPool.request().query(sampleQuery);

        if (sampleResult.recordset.length === 0) {
          throw new Error('No se encontraron registros en la tabla para detectar campos');
        }

        const sampleRow = sampleResult.recordset[0];
        const fields = [];

        // Iterar sobre columnas
        for (const columnName in sampleRow) {
          const value = sampleRow[columnName];
          fields.push({
            name: columnName,
            type: this.detectFieldType(columnName, value),
            sample: this.getSampleValue(value),
            required: false,
            description: this.generateFieldDescription(columnName, value)
          });
        }

        console.log(`✅ Detected ${fields.length} fields from SQL Database`);
        return fields;
      } finally {
        await externalPool.close();
      }
    } catch (error) {
      console.error("❌ Error detecting fields from SQL:", error);
      throw error;
    }
  }

  /**
   * Detecta tipo de campo basado en nombre y valor
   */
  detectFieldType(columnName, value) {
    const name = columnName.toLowerCase();

    // URLs
    if (name.includes("url") || name.includes("link")) {
      return "url";
    }

    // Fechas
    if (name.includes("date") || name.includes("fecha") || value instanceof Date) {
      return "date";
    }

    // Números
    if (typeof value === 'number' || name.includes("id") || name.includes("count") || 
        name.includes("salary") || name.includes("salario")) {
      return "number";
    }

    // Por defecto string
    return "string";
  }

  /**
   * Obtiene valor de muestra (limitado)
   */
  getSampleValue(value) {
    if (value === null || value === undefined) {
      return "";
    }

    const stringValue = String(value);
    return stringValue.length > 100 ? stringValue.substring(0, 100) + "..." : stringValue;
  }

  /**
   * Genera descripción del campo
   */
  generateFieldDescription(columnName, value) {
    const name = columnName.toLowerCase();

    const descriptions = {
      id: "ID único de la oferta",
      title: "Título de la oferta",
      jobtitle: "Título del puesto",
      company: "Nombre de la empresa",
      description: "Descripción del puesto",
      // ... más descripciones
    };

    return descriptions[name] || `Campo: ${columnName}`;
  }

  /**
   * Procesa e importa ofertas desde BD externa
   */
  async process() {
    let externalPool = null;
    try {
      console.log("🔄 Starting SQL import process...");

      const credentials = await this.getCredentials();
      const sqlConfig = this.getSQLConfig();

      // Validar VPN en desarrollo
      if (process.env.EXTERNAL_DB_VPN_CHECK_ENABLED === 'true') {
        await this.validateVPNConnection(credentials.server);
      }

      // Configurar conexión externa
      const externalConfig = {
        server: credentials.server,
        database: credentials.database || sqlConfig.database,
        user: credentials.user,
        password: credentials.password,
        port: credentials.port || 1433,
        connectionTimeout: 30000, // 30s timeout
        requestTimeout: 60000,    // 60s para queries largas
        pool: {
          max: 1, // Solo una conexión concurrente por importación
          min: 0,
          idleTimeoutMillis: 30000
        },
        options: {
          encrypt: credentials.options?.encrypt !== false,
          trustServerCertificate: credentials.options?.trustServerCertificate || false,
          enableArithAbort: true
        }
      };

      // Conectar a BD externa
      console.log(`🔌 Conectando a BD externa: ${credentials.server}/${sqlConfig.database}`);
      externalPool = new sql.ConnectionPool(externalConfig);
      await externalPool.connect();
      console.log("✅ Conexión a BD externa establecida");

      // Ejecutar query configurada
      const query = sqlConfig.query || `SELECT * FROM ${sqlConfig.tableName || 'JobOffers'}`;
      console.log(`📊 Ejecutando query: ${query.substring(0, 100)}...`);

      const result = await externalPool.request().query(query);
      const offers = result.recordset;

      console.log(`📦 Ofertas obtenidas de BD externa: ${offers.length}`);

      if (offers.length === 0) {
        return {
          processed: 0,
          created: 0,
          updated: 0,
          errors: 0,
          message: "No se encontraron ofertas en la BD externa"
        };
      }

      // Procesar ofertas (similar a XMLProcessor/APIProcessor)
      const processed = await this.processOffers(offers);

      return processed;

    } catch (error) {
      console.error("❌ Error processing SQL connection:", error);
      
      // Determinar si es error de VPN (solo desarrollo)
      if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
        throw new Error(
          `Error de conectividad. En desarrollo, verifique que la VPN esté activa. ` +
          `Error: ${error.message}`
        );
      }

      throw error;
    } finally {
      // Cerrar conexión externa
      if (externalPool) {
        try {
          await externalPool.close();
          console.log("✅ Conexión a BD externa cerrada");
        } catch (closeError) {
          console.error("⚠️ Error cerrando conexión externa:", closeError);
        }
      }
    }
  }

  /**
   * Procesa ofertas individuales e inserta en BD local
   */
  async processOffers(offers) {
    const stats = {
      processed: 0,
      created: 0,
      updated: 0,
      errors: 0
    };

    await pool.connect();

    for (const offer of offers) {
      try {
        // Obtener mapeo de campos (de ClientFieldMappings)
        const mappings = await this.getFieldMappings();

        // Transformar oferta usando mapeo
        const transformedOffer = this.transformOffer(offer, mappings);

        // Insertar o actualizar en BD local
        const result = await this.upsertOffer(transformedOffer);

        if (result.created) {
          stats.created++;
        } else {
          stats.updated++;
        }
        stats.processed++;

      } catch (error) {
        console.error(`❌ Error procesando oferta:`, error);
        stats.errors++;
      }
    }

    return stats;
  }

  /**
   * Obtiene mapeo de campos configurado
   */
  async getFieldMappings() {
    // Similar a XMLProcessor - obtener de ClientFieldMappings
    // Implementar según necesidad
    return {};
  }

  /**
   * Transforma oferta según mapeo de campos
   */
  transformOffer(offer, mappings) {
    // Similar a XMLProcessor - transformar según mapeo
    // Implementar según necesidad
    return offer;
  }

  /**
   * Inserta o actualiza oferta en BD local
   */
  async upsertOffer(offer) {
    // Similar a XMLProcessor - upsert logic
    // Implementar según necesidad
    return { created: true };
  }
}

module.exports = SQLProcessor;
```

---

### **Paso 3: Actualizar routes/connections.js**

**Agregar soporte para tipo "SQL":**

```javascript
// En POST /api/connections - validar tipo
const validTypes = ["XML", "API", "Manual", "SQL"]; // Agregar "SQL"
if (!validTypes.includes(type)) {
  return res.status(400).json({
    error: "Tipo de conexión inválido",
    validTypes: ["XML", "API", "Manual", "SQL"],
  });
}

// En POST /api/connections/:id/sync - agregar procesador SQL
if (connectionType.toLowerCase() === "sql") {
  const SQLProcessor = require("../processors/sqlProcessor");
  processor = new SQLProcessor(connection);
} else if (connectionType.toLowerCase() === "xml") {
  // ... existente
}

// En GET /api/connections/:id/detect-fields - agregar SQL
if (connectionType.toLowerCase() === "sql") {
  const SQLProcessor = require("../processors/sqlProcessor");
  processor = new SQLProcessor(connection);
  fields = await processor.detectFields();
}
```

---

### **Paso 4: Endpoint para Configurar Credenciales SQL**

**Crear endpoint específico para credenciales SQL:**

```javascript
// backend/src/routes/connections.js

// POST /api/connections/:id/credentials
router.post("/:id/credentials", addUserToRequest, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { server, database, user, password, port, encrypt, trustServerCertificate } = req.body;

    // Validar campos requeridos
    if (!server || !database || !user || !password) {
      return res.status(400).json({
        error: "Faltan campos requeridos",
        required: ["server", "database", "user", "password"]
      });
    }

    // Encriptar credenciales
    const credentialsManager = new CredentialsManager();
    const credentials = {
      server,
      database,
      user,
      password,
      port: port || 1433,
      encrypt: encrypt !== false,
      trustServerCertificate: trustServerCertificate || false
    };

    const encryptedCredentials = credentialsManager.encryptCredentials(credentials);

    // Guardar en UserChannelCredentials
    // Canal especial: "sql_{connectionId}"
    const channelId = `sql_${id}`;
    
    await pool.request()
      .input('userId', sql.BigInt, req.userId)
      .input('channelId', sql.NVarChar(100), channelId)
      .input('channelName', sql.NVarChar(255), `SQL Connection ${id}`)
      .input('encryptedCredentials', sql.NVarChar(sql.MAX), encryptedCredentials)
      .input('isActive', sql.Bit, 1)
      .input('isValidated', sql.Bit, 0) // Se validará con test connection
      .query(`
        MERGE UserChannelCredentials AS target
        USING (SELECT @userId as UserId, @channelId as ChannelId) AS source
        ON target.UserId = source.UserId AND target.ChannelId = source.ChannelId
        WHEN MATCHED THEN
          UPDATE SET 
            EncryptedCredentials = @encryptedCredentials,
            IsActive = @isActive,
            UpdatedAt = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (UserId, ChannelId, ChannelName, EncryptedCredentials, IsActive, IsValidated, CreatedAt, UpdatedAt)
          VALUES (@userId, @channelId, @channelName, @encryptedCredentials, @isActive, @isValidated, GETDATE(), GETDATE());
      `);

    res.json({
      success: true,
      message: "Credenciales SQL guardadas exitosamente"
    });

  } catch (error) {
    console.error("❌ Error guardando credenciales SQL:", error);
    res.status(500).json({
      error: "Error interno del servidor",
      details: error.message
    });
  }
});

// POST /api/connections/:id/test-sql
router.post("/:id/test-sql", addUserToRequest, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    // Obtener conexión
    const connectionResult = await pool.request()
      .input('id', sql.Int, id)
      .input('userId', sql.BigInt, req.userId)
      .query(`
        SELECT * FROM Connections 
        WHERE id = @id AND UserId = @userId
      `);

    if (connectionResult.recordset.length === 0) {
      return res.status(404).json({ error: "Conexión no encontrada" });
    }

    const connection = connectionResult.recordset[0];

    if (connection.type !== 'SQL') {
      return res.status(400).json({ error: "Esta conexión no es de tipo SQL" });
    }

    // Probar conexión
    const SQLProcessor = require("../processors/sqlProcessor");
    const processor = new SQLProcessor(connection);
    const testResult = await processor.testConnection();

    // Marcar como validada si funciona
    if (testResult.success) {
      await pool.request()
        .input('userId', sql.BigInt, req.userId)
        .input('channelId', sql.NVarChar(100), `sql_${id}`)
        .query(`
          UPDATE UserChannelCredentials
          SET IsValidated = 1, UpdatedAt = GETDATE()
          WHERE UserId = @userId AND ChannelId = @channelId
        `);
    }

    res.json(testResult);

  } catch (error) {
    console.error("❌ Error probando conexión SQL:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      details: error.code
    });
  }
});
```

---

### **Paso 5: Frontend - UI para Configurar Conexión SQL**

**Agregar formulario para tipo SQL en `frontend/app/conexiones/`:**

```typescript
// Ejemplo de campos adicionales para tipo SQL
{
  type: "SQL",
  // Campos adicionales en Notes (JSON):
  notes: JSON.stringify({
    server: "sql-externo.ejemplo.com",
    database: "OfertasDB",
    tableName: "JobOffers",
    query: "SELECT * FROM JobOffers WHERE Status = 'Active'"
  })
}

// Formulario separado para credenciales SQL:
// POST /api/connections/:id/credentials
{
  server: string;
  database: string;
  user: string;
  password: string;
  port?: number;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
}
```

---

## 🔒 **CONSIDERACIONES DE SEGURIDAD**

### **1. Encriptación de Credenciales**
- ✅ Usar `CredentialsManager` (AES-256-GCM)
- ✅ Almacenar en `UserChannelCredentials` (no en `Connections`)
- ✅ Nunca loggear credenciales en texto plano

### **2. Validación de Acceso**
- ✅ Verificar que usuario solo acceda a sus propias conexiones
- ✅ Validar que conexión SQL pertenece al usuario antes de usar credenciales

### **3. Timeouts y Límites**
- ✅ Timeout de conexión: 30s
- ✅ Timeout de query: 60s
- ✅ Límite de conexiones concurrentes: 1 por usuario
- ✅ Rate limiting en endpoints de test/sync

### **4. Logging Seguro**
```javascript
// ✅ CORRECTO: Loggear sin credenciales
console.log(`Conectando a ${credentials.server}/${credentials.database}`);

// ❌ INCORRECTO: Loggear credenciales
console.log(`Usuario: ${credentials.user}, Password: ${credentials.password}`);
```

### **5. Manejo de Errores**
```javascript
// No exponer detalles de BD externa en errores públicos
catch (error) {
  if (process.env.NODE_ENV === 'production') {
    // Error genérico para usuarios
    throw new Error('Error de conexión a base de datos externa');
  } else {
    // Error detallado solo en desarrollo
    throw error;
  }
}
```

---

## 🚀 **CONFIGURACIÓN DE ENTORNO**

### **Desarrollo (.env.development)**
```env
NODE_ENV=development
EXTERNAL_DB_REQUIRE_VPN=true
EXTERNAL_DB_VPN_CHECK_ENABLED=true
EXTERNAL_DB_TIMEOUT=30000
EXTERNAL_DB_QUERY_TIMEOUT=60000
```

### **Producción (.env.production)**
```env
NODE_ENV=production
EXTERNAL_DB_REQUIRE_VPN=false
EXTERNAL_DB_VPN_CHECK_ENABLED=false
EXTERNAL_DB_TIMEOUT=10000
EXTERNAL_DB_QUERY_TIMEOUT=30000
```

---

## 📋 **CHECKLIST DE IMPLEMENTACIÓN**

### **Backend:**
- [ ] Crear `backend/src/processors/sqlProcessor.js`
- [ ] Actualizar `backend/src/routes/connections.js`:
  - [ ] Agregar "SQL" a tipos válidos
  - [ ] Agregar procesador SQL en sync
  - [ ] Agregar procesador SQL en detect-fields
  - [ ] Crear endpoint `/api/connections/:id/credentials`
  - [ ] Crear endpoint `/api/connections/:id/test-sql`
- [ ] Agregar variables de entorno
- [ ] Actualizar documentación Swagger

### **Frontend:**
- [ ] Agregar opción "SQL" en formulario de conexión
- [ ] Crear formulario para configurar BD SQL (server, database, query)
- [ ] Crear formulario para credenciales SQL (separado, más seguro)
- [ ] Agregar botón "Probar Conexión"
- [ ] Agregar validación de VPN en desarrollo (opcional: mostrar aviso)

### **Seguridad:**
- [ ] Verificar que credenciales se encriptan correctamente
- [ ] Verificar que solo usuario propietario puede usar conexión
- [ ] Implementar rate limiting
- [ ] Agregar logging seguro (sin credenciales)

### **Testing:**
- [ ] Probar conexión en desarrollo (con VPN)
- [ ] Probar conexión sin VPN (debe fallar con mensaje claro)
- [ ] Probar conexión en producción (sin VPN)
- [ ] Probar detección de campos
- [ ] Probar importación completa
- [ ] Probar manejo de errores

---

## ⚠️ **LIMITACIONES Y CONSIDERACIONES**

1. **VPN en Desarrollo:**
   - No se puede validar automáticamente si VPN está activa
   - Solución: Validar conectividad (DNS lookup o ping)
   - Mostrar mensaje claro si falla: "Verifique que VPN esté activa"

2. **Producción sin VPN:**
   - BD externa debe estar accesible desde servidor cloud
   - Posible necesidad de whitelist IPs
   - Considerar bastion host para acceso seguro

3. **Performance:**
   - Queries grandes pueden ser lentas
   - Implementar paginación o límites en queries
   - Considerar sincronización incremental (solo cambios)

4. **Dependencias:**
   - Requiere `mssql` package (ya instalado)
   - Compatible con SQL Server, Azure SQL, etc.

---

## 🎯 **PRÓXIMOS PASOS**

1. Implementar `SQLProcessor` básico
2. Agregar endpoints de configuración
3. Crear UI en frontend
4. Testing en desarrollo con VPN
5. Configurar producción (acceso directo)

---

**¿Necesitas ayuda implementando alguna parte específica?** Puedo generar el código completo para cualquier componente.

