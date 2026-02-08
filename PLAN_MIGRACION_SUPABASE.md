# 📋 PLAN DE MIGRACIÓN A SUPABASE - PASO A PASO

**Fecha:** 2025-01-29
**Objetivo:** Migrar de SQL Server local + Backend Express → Supabase
**Tiempo estimado:** 6-8 horas total

---

## 🎯 RESUMEN DEL PLAN

### **LO QUE VAMOS A HACER:**

1. ✅ Crear proyecto Supabase (30 min)
2. ✅ Migrar schema SQL Server → PostgreSQL (1 hora)
3. ✅ Migrar datos con script automático (1 hora)
4. ✅ Probar datos migrados (30 min)
5. ✅ Actualizar frontend para usar Supabase (2 horas)
6. ✅ Configurar Row Level Security (1 hora)
7. ✅ Deploy a Vercel (30 min)
8. ✅ Testing final (1 hora)

### **LO QUE NO VAMOS A TOCAR (por ahora):**

- ❌ Backend Express (lo mantenemos funcionando local como backup)
- ❌ SQL Server local (no lo borramos, queda como respaldo)
- ❌ Landing page (ya funciona, no la tocamos)
- ❌ Edge Functions complejas (las hacemos después, si necesitamos)

### **ESTRATEGIA: Migración incremental sin romper nada**

```
Fase 1: Setup Supabase + Migrar datos
  ├─ Local sigue funcionando (SQL Server + Backend Express)
  └─ Supabase nuevo (PostgreSQL en cloud)

Fase 2: Actualizar frontend para usar Supabase
  ├─ Cambiar solo frontend/lib/
  └─ Backend Express sigue corriendo (por si acaso)

Fase 3: Testing con Supabase
  ├─ Si funciona → Deploy a Vercel
  └─ Si falla → Revertimos a backend Express

Fase 4: Deploy online
  ├─ Vercel apunta a Supabase
  └─ Local puede seguir con SQL Server
```

---

## 📊 ESTADO ACTUAL (INVENTARIO)

### **Base de Datos SQL Server (local):**

```sql
-- Tablas principales:
Users                     -- 15 usuarios
Channels                  -- 7 canales (Jooble, Talent, etc.)
JobOffers                 -- 67,696 ofertas (Usuario 11)
Campaigns                 -- 9 campañas
CampaignOffers           -- Relaciones campaña-oferta
CampaignChannels         -- Presupuestos por canal
Segments                 -- Segmentación de ofertas
Connections              -- Conexiones XML/API
FieldMappings            -- Mapeos de campos
UserChannelCredentials   -- Credenciales encriptadas
OfferMetrics             -- (vacía, para Turijobs futuro)
OfferMetricsByChannel    -- (vacía, para Turijobs futuro)
OfferMetricsHistory      -- (vacía, para Turijobs futuro)
```

### **Backend Express (local):**

```
backend/
├── src/
│   ├── routes/
│   │   ├── auth.js              ← Login/Register (200 líneas)
│   │   ├── campaigns.js         ← CRUD campañas
│   │   ├── metrics.js           ← Dashboard métricas
│   │   ├── offers.js            ← CRUD ofertas
│   │   ├── segments.js          ← Segmentación
│   │   ├── userCredentials.js   ← Canales distribución
│   │   └── ...
│   ├── services/
│   │   ├── channels/
│   │   │   ├── joobleService.js      ← Integración Jooble
│   │   │   ├── talentService.js      ← Integración Talent
│   │   │   ├── jobRapidoService.js   ← Integración JobRapido
│   │   │   └── whatJobsService.js    ← Integración WhatJobs
│   │   ├── metricsSync.js            ← Sync métricas cada 5 min
│   │   └── ...
│   └── db/
│       └── db.js                ← Conexión SQL Server
└── index.js                     ← Express server (puerto 3002)
```

### **Frontend Next.js (local):**

```
frontend/
├── app/
│   ├── login/                   ← Página login
│   ├── register/                ← Página registro
│   ├── page.tsx                 ← Dashboard principal
│   ├── campanas/                ← Gestión campañas
│   ├── ofertas/                 ← Gestión ofertas
│   ├── segmentos/               ← Segmentación
│   └── credenciales/            ← Canales distribución
├── contexts/
│   └── AuthContext.tsx          ← Auth manual con JWT
├── hooks/
│   └── useAuthFetch.ts          ← Fetch con token
└── lib/
    ├── auth-sync.ts             ← Sync entre pestañas
    └── api.ts                   ← Llamadas a http://localhost:3002
```

---

## 🎯 DECISIONES ESTRATÉGICAS ANTES DE EMPEZAR

### **DECISIÓN 1: ¿Qué migramos primero?**

**Opción A: Todo de golpe** (NO recomendado)
- ❌ Alto riesgo
- ❌ Si algo falla, no hay backup
- ❌ Difícil debuggear

**Opción B: Incremental - Solo lectura primero** ⭐ **RECOMENDADO**
- ✅ Migramos BD a Supabase
- ✅ Frontend lee de Supabase
- ✅ Escrituras siguen en backend Express (temporal)
- ✅ Si falla, revertimos fácil

**Opción C: Incremental - Página por página**
- ✅ Migramos dashboard primero
- ✅ Login sigue con backend Express
- ✅ Luego migramos campañas, ofertas, etc.
- 🟡 Más trabajo (código mixto)

**MI RECOMENDACIÓN:** **Opción B**
- Empezamos con lecturas (dashboard, listados)
- Dejamos escrituras (crear campaña, login) para después
- Menos riesgo, más control

---

### **DECISIÓN 2: ¿Qué hacemos con el backend Express?**

**Opción A: Eliminarlo completamente**
- ❌ Pierdes servicios complejos (Jooble sync, procesamiento XML)
- ❌ Necesitas reescribir todo en Edge Functions
- ❌ Alto riesgo

**Opción B: Mantenerlo para lógica compleja** ⭐ **RECOMENDADO**
- ✅ Queries simples → Supabase (frontend directo)
- ✅ Lógica compleja → Backend Express (sigue corriendo)
- ✅ Servicios de canales → Backend Express (sin cambios)
- ✅ Sync métricas → Backend Express (sin cambios)

**Opción C: Migrar a Edge Functions gradualmente**
- 🟡 Queries → Supabase (frontend)
- 🟡 Lógica → Edge Functions (Deno)
- 🟡 Servicios → Edge Functions (reescribir)
- 🟡 Más trabajo, pero más "serverless"

**MI RECOMENDACIÓN:** **Opción B**
- Frontend usa Supabase para CRUD simple
- Backend Express sigue corriendo para:
  - Sync con Jooble/Talent/JobRapido/WhatJobs
  - Procesamiento XML/CSV
  - Lógica compleja de campañas
- Después (si quieres) migramos a Edge Functions

---

### **DECISIÓN 3: ¿Qué hacemos con Auth?**

**Opción A: Migrar a Supabase Auth** ⭐ **RECOMENDADO**
- ✅ Eliminas 200 líneas de código auth
- ✅ JWT automático
- ✅ Session management incluido
- ✅ Más simple

**Opción B: Mantener auth custom**
- 🟡 Sigue usando backend Express para login
- 🟡 Supabase solo para datos
- 🟡 Más complejo (2 sistemas auth)

**MI RECOMENDACIÓN:** **Opción A**
- Supabase Auth es más seguro y simple
- Elimina código custom
- Compatible con OAuth si quieres después

---

### **DECISIÓN 4: ¿Migramos todos los datos o solo recientes?**

**Opción A: Todo (67,696 ofertas)**
- ✅ Completo, sin pérdida de datos
- 🟡 Migración tarda ~30-60 min
- 🟡 Usa ~400-500 MB del tier gratuito (500 MB límite)

**Opción B: Solo últimos 6 meses** ⭐ **RECOMENDADO SI TIENES OFERTAS VIEJAS**
- ✅ Migración rápida (5-10 min)
- ✅ Datos relevantes
- ✅ Usa ~100-200 MB
- ✅ Resto queda en SQL Server como histórico

**MI RECOMENDACIÓN:**
- Si tus 67K ofertas incluyen muchas vencidas/archivadas → **Opción B**
- Si son todas activas/relevantes → **Opción A**

---

## 📋 PLAN DETALLADO - FASE POR FASE

### **FASE 1: SETUP SUPABASE (30 minutos)**

**Objetivo:** Crear proyecto y obtener credenciales.

**Pasos:**
1. Ir a https://supabase.com
2. Crear cuenta (GitHub login recomendado)
3. "New Project"
   - Name: `job-platform`
   - Database Password: `[guardar en .env]`
   - Region: `Europe West (London)`
4. Esperar ~2 minutos (proyecto se crea)
5. Copiar credenciales:
   - `Project URL`
   - `anon public key`
   - `service_role key` (privado, solo backend)

**Resultado esperado:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_KEY=eyJhbGci... (privado)
```

**Riesgos:** Ninguno (solo crear cuenta)

---

### **FASE 2: MIGRAR SCHEMA (1 hora)**

**Objetivo:** Crear tablas en PostgreSQL que repliquen SQL Server.

**Sub-pasos:**

#### **2.1 Exportar schema SQL Server (10 min)**

Script SQL para generar CREATE TABLEs:
```sql
-- Ejecutar en SQL Server Management Studio
SELECT
    'CREATE TABLE [' + t.name + '] (' + CHAR(13) +
    STUFF((
        SELECT ',' + CHAR(13) +
            '    [' + c.name + '] ' +
            TYPE_NAME(c.user_type_id) +
            CASE
                WHEN TYPE_NAME(c.user_type_id) IN ('varchar', 'nvarchar', 'char', 'nchar')
                THEN '(' + CASE WHEN c.max_length = -1 THEN 'MAX' ELSE CAST(c.max_length AS VARCHAR) END + ')'
                WHEN TYPE_NAME(c.user_type_id) IN ('decimal', 'numeric')
                THEN '(' + CAST(c.precision AS VARCHAR) + ',' + CAST(c.scale AS VARCHAR) + ')'
                ELSE ''
            END +
            CASE WHEN c.is_nullable = 0 THEN ' NOT NULL' ELSE ' NULL' END +
            CASE WHEN c.is_identity = 1 THEN ' IDENTITY(1,1)' ELSE '' END
        FROM sys.columns c
        WHERE c.object_id = t.object_id
        ORDER BY c.column_id
        FOR XML PATH('')
    ), 1, 1, '') + CHAR(13) + ');' AS CreateTableStatement
FROM sys.tables t
WHERE t.type = 'U'
  AND t.name NOT LIKE 'sys%'
ORDER BY t.name;
```

**Resultado:** Archivo `schema-sql-server.sql` con todas las tablas.

#### **2.2 Convertir a PostgreSQL (20 min)**

**Conversiones necesarias:**

| SQL Server | PostgreSQL |
|------------|------------|
| `NVARCHAR(MAX)` | `TEXT` |
| `NVARCHAR(255)` | `VARCHAR(255)` |
| `DATETIME2` | `TIMESTAMP` |
| `BIT` | `BOOLEAN` |
| `IDENTITY(1,1)` | `SERIAL` o `BIGSERIAL` |
| `GETDATE()` | `NOW()` |
| `@param` | `$1, $2, $3` |

**Herramienta automática:** https://www.sqlines.com/online

**Resultado:** Archivo `schema-postgresql.sql` convertido.

#### **2.3 Ejecutar en Supabase (30 min)**

1. Supabase Dashboard → SQL Editor
2. Pegar schema PostgreSQL
3. Run
4. Verificar tablas creadas en Table Editor

**Riesgos:**
- 🟡 Foreign keys pueden fallar (orden de creación)
- ✅ Solución: Crear tablas primero, FKs después

---

### **FASE 3: MIGRAR DATOS (1 hora)**

**Objetivo:** Copiar datos de SQL Server a Supabase PostgreSQL.

**Método recomendado:** Script Node.js automático

#### **Script de migración:**

```javascript
// backend/scripts/migrate-to-supabase.js
const sql = require('mssql');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY // Usar service_role, no anon
);

const sqlConfig = {
  server: 'localhost',
  database: 'JobPlatform',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

// Orden de migración (respetando foreign keys)
const tables = [
  'Users',
  'Channels',
  'Connections',
  'JobOffers',
  'Campaigns',
  'Segments',
  'CampaignOffers',
  'CampaignChannels',
  'FieldMappings',
  'UserChannelCredentials'
];

async function migrateTable(tableName, pool) {
  console.log(`\n🔄 Migrando ${tableName}...`);

  // 1. Obtener datos de SQL Server
  const result = await pool.request().query(`SELECT * FROM ${tableName}`);
  const rows = result.recordset;

  if (rows.length === 0) {
    console.log(`   ⏭️  ${tableName} vacía, saltando...`);
    return { inserted: 0, errors: 0 };
  }

  console.log(`   📊 ${rows.length} registros encontrados`);

  // 2. Insertar en Supabase en batches de 1000
  const batchSize = 1000;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);

    try {
      const { error } = await supabase
        .from(tableName)
        .insert(batch);

      if (error) {
        console.error(`   ❌ Error en batch ${i}-${i + batch.length}:`, error.message);
        errors += batch.length;
      } else {
        console.log(`   ✅ Batch ${i}-${i + batch.length} migrado`);
        inserted += batch.length;
      }
    } catch (err) {
      console.error(`   ❌ Excepción en batch:`, err.message);
      errors += batch.length;
    }
  }

  return { inserted, errors };
}

async function migrate() {
  console.log('🚀 Iniciando migración SQL Server → Supabase\n');

  const pool = await sql.connect(sqlConfig);
  const results = {};

  for (const table of tables) {
    results[table] = await migrateTable(table, pool);
  }

  await pool.close();

  console.log('\n📊 RESUMEN DE MIGRACIÓN:');
  console.log('═'.repeat(60));

  let totalInserted = 0;
  let totalErrors = 0;

  for (const [table, result] of Object.entries(results)) {
    console.log(`${table.padEnd(30)} ${result.inserted} ✅  ${result.errors} ❌`);
    totalInserted += result.inserted;
    totalErrors += result.errors;
  }

  console.log('═'.repeat(60));
  console.log(`TOTAL: ${totalInserted} registros migrados, ${totalErrors} errores`);

  if (totalErrors === 0) {
    console.log('\n🎉 ¡Migración completada exitosamente!');
  } else {
    console.log('\n⚠️  Migración completada con errores. Revisar logs arriba.');
  }
}

migrate().catch(console.error);
```

**Ejecutar:**
```bash
cd C:/Dev/job-platform/backend
npm install @supabase/supabase-js
node scripts/migrate-to-supabase.js
```

**Tiempo estimado:**
- 67,696 ofertas en batches de 1000 = ~68 batches
- ~1 segundo por batch = ~70 segundos
- Total: ~1-2 minutos por tabla grande

**Riesgos:**
- 🟡 Foreign key violations (si orden incorrecto)
- 🟡 Campos incompatibles (NULL constraints)
- ✅ Script muestra errores específicos para corregir

---

### **FASE 4: VERIFICAR MIGRACIÓN (30 min)**

**Objetivo:** Confirmar que datos migraron correctamente.

**Checklist:**

1. **Supabase Table Editor:**
   - ✅ Users: 15 registros
   - ✅ Channels: 7 registros
   - ✅ JobOffers: 67,696 registros (o cantidad esperada)
   - ✅ Campaigns: 9 registros
   - ✅ CampaignOffers: verificar relaciones

2. **SQL Editor queries de verificación:**
```sql
-- Verificar conteos
SELECT 'Users' AS tabla, COUNT(*) AS registros FROM "Users"
UNION ALL
SELECT 'JobOffers', COUNT(*) FROM "JobOffers"
UNION ALL
SELECT 'Campaigns', COUNT(*) FROM "Campaigns";

-- Verificar usuario específico
SELECT * FROM "Users" WHERE "Email" = 'michael.munoz@turijobs.com';

-- Verificar ofertas de usuario 11
SELECT COUNT(*) FROM "JobOffers" WHERE "UserId" = 11;

-- Verificar campañas activas
SELECT * FROM "Campaigns" WHERE "StatusId" = 1;
```

3. **Comparar con SQL Server:**
```sql
-- En SQL Server:
SELECT COUNT(*) FROM Users;
SELECT COUNT(*) FROM JobOffers;
SELECT COUNT(*) FROM Campaigns;

-- Deben coincidir con Supabase
```

**Resultado esperado:**
- ✅ Conteos coinciden
- ✅ Relaciones intactas (foreign keys)
- ✅ Datos sensibles migrados (passwords, credentials)

---

### **FASE 5: ACTUALIZAR FRONTEND (2 horas)**

**Objetivo:** Frontend usa Supabase en lugar de backend Express.

**Sub-fases:**

#### **5.1 Instalar Supabase Client (5 min)**
```bash
cd C:/Dev/job-platform/frontend
npm install @supabase/supabase-js
```

#### **5.2 Crear Supabase client (10 min)**

**Archivo: `frontend/lib/supabase.ts`**
```typescript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

**Variables en `.env.local`:**
```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
```

#### **5.3 Migrar Auth a Supabase (45 min)**

**ANTES (AuthContext.tsx - complejo):**
- Login manual con fetch a backend
- JWT manual
- Refresh token manual
- Session storage manual

**DESPUÉS (AuthContext.tsx - simple):**
```typescript
import { supabase } from '@/lib/supabase';

const login = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;
  return data.user;
};

const register = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });

  if (error) throw error;
  return data.user;
};

const logout = async () => {
  await supabase.auth.signOut();
};

// Session auto-refresh (Supabase lo maneja)
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(
    (event, session) => {
      setUser(session?.user ?? null);
    }
  );

  return () => subscription.unsubscribe();
}, []);
```

#### **5.4 Migrar queries a Supabase (1 hora)**

**Ejemplo: Dashboard métricas**

**ANTES:**
```typescript
const response = await fetch('http://localhost:3002/api/metrics/dashboard', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const data = await response.json();
```

**DESPUÉS:**
```typescript
// Campañas activas
const { data: campaigns } = await supabase
  .from('Campaigns')
  .select('*')
  .eq('UserId', user.id)
  .eq('StatusId', 1);

// Ofertas activas
const { data: offers } = await supabase
  .from('JobOffers')
  .select('*')
  .eq('UserId', user.id)
  .eq('StatusId', 1);

// Presupuesto total
const { data: budget } = await supabase
  .from('CampaignChannels')
  .select('AllocatedBudget')
  .eq('UserId', user.id);

const totalBudget = budget?.reduce((sum, b) => sum + b.AllocatedBudget, 0);
```

**Páginas a actualizar:**
- ✅ `app/page.tsx` - Dashboard
- ✅ `app/campanas/page.tsx` - Lista campañas
- ✅ `app/ofertas/page.tsx` - Lista ofertas
- ✅ `app/segmentos/page.tsx` - Lista segmentos
- 🟡 `app/credenciales/page.tsx` - (mantener backend Express por ahora)

---

### **FASE 6: ROW LEVEL SECURITY (1 hora)**

**Objetivo:** Proteger datos - usuarios solo ven lo suyo.

**CRÍTICO:** Sin RLS, cualquier usuario podría ver datos de otros.

**Pasos:**

#### **6.1 Habilitar RLS en todas las tablas**
```sql
-- En Supabase SQL Editor:
ALTER TABLE "Users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobOffers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampaignOffers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampaignChannels" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Segments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Connections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FieldMappings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserChannelCredentials" ENABLE ROW LEVEL SECURITY;
```

#### **6.2 Crear políticas por tabla**

**Ejemplo: Campaigns**
```sql
-- SELECT: Users solo ven sus campañas
CREATE POLICY "Users can view own campaigns"
ON "Campaigns"
FOR SELECT
USING (auth.uid()::text = "UserId"::text);

-- INSERT: Users solo crean campañas propias
CREATE POLICY "Users can insert own campaigns"
ON "Campaigns"
FOR INSERT
WITH CHECK (auth.uid()::text = "UserId"::text);

-- UPDATE: Users solo actualizan sus campañas
CREATE POLICY "Users can update own campaigns"
ON "Campaigns"
FOR UPDATE
USING (auth.uid()::text = "UserId"::text);

-- DELETE: Users solo eliminan sus campañas
CREATE POLICY "Users can delete own campaigns"
ON "Campaigns"
FOR DELETE
USING (auth.uid()::text = "UserId"::text);
```

**Repetir para todas las tablas con UserId.**

**Tabla especial: Channels (pública)**
```sql
-- Todos pueden leer canales (Jooble, Talent, etc.)
CREATE POLICY "Channels are public readable"
ON "Channels"
FOR SELECT
USING (true);
```

---

### **FASE 7: TESTING LOCAL (1 hora)**

**Objetivo:** Verificar que frontend con Supabase funciona.

**Checklist:**

1. **Login:**
   - ✅ Email/password funciona
   - ✅ JWT token automático
   - ✅ Session persiste en refresh

2. **Dashboard:**
   - ✅ Métricas se cargan
   - ✅ Solo ve datos propios (RLS)
   - ✅ Performance <500ms

3. **Campañas:**
   - ✅ Lista se carga
   - ✅ Crear nueva campaña funciona
   - ✅ Editar campaña funciona
   - ✅ Eliminar campaña funciona

4. **Ofertas:**
   - ✅ Lista se carga con paginación
   - ✅ Filtros funcionan
   - ✅ Solo ve ofertas propias

5. **Multi-usuario:**
   - ✅ Login con usuario A
   - ✅ No ve datos de usuario B
   - ✅ RLS funciona correctamente

**Si algo falla:**
- 🔴 Revisar políticas RLS
- 🔴 Verificar auth.uid() en policies
- 🔴 Comprobar que UserId es tipo correcto (UUID vs INT)

---

### **FASE 8: DEPLOY A VERCEL (30 min)**

**Objetivo:** Poner online con Supabase.

**Pasos:**

1. **Commit cambios:**
```bash
cd C:/Dev/job-platform/frontend
git add .
git commit -m "Migración a Supabase - Frontend actualizado"
git push origin main
```

2. **Configurar variables en Vercel:**
   - Dashboard Vercel → Project Settings → Environment Variables
   - Agregar:
     ```
     NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
     NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
     ```

3. **Redeploy:**
   - Vercel auto-deploya con push
   - O manual: Dashboard → Redeploy

4. **Verificar online:**
   - https://job-platform.vercel.app
   - Login funciona
   - Dashboard carga datos

---

## ⚠️ RIESGOS Y MITIGACIONES

### **Riesgo 1: Migración de datos falla**
- **Probabilidad:** 🟡 Media (foreign keys, NULL constraints)
- **Impacto:** 🔴 Alto (sin datos, no funciona)
- **Mitigación:**
  - ✅ Backup SQL Server antes (automático)
  - ✅ Script muestra errores específicos
  - ✅ SQL Server sigue intacto (rollback fácil)

### **Riesgo 2: RLS mal configurado**
- **Probabilidad:** 🟡 Media (primera vez con RLS)
- **Impacto:** 🔴 Alto (usuarios ven datos de otros)
- **Mitigación:**
  - ✅ Testing con 2 usuarios antes de deploy
  - ✅ Verificar queries con Supabase logs
  - ✅ Rollback: Deshabilitar RLS temporalmente

### **Riesgo 3: Performance degradado**
- **Probabilidad:** 🟢 Baja (Supabase usa PostgreSQL optimizado)
- **Impacto:** 🟡 Medio (queries lentas)
- **Mitigación:**
  - ✅ Crear índices en columnas frecuentes (UserId, StatusId)
  - ✅ Usar Supabase Performance Insights
  - ✅ Caché en frontend (React Query / SWR)

### **Riesgo 4: Servicios de canales dejan de funcionar**
- **Probabilidad:** 🟢 Muy baja (backend Express sigue corriendo)
- **Impacto:** 🔴 Alto (no puedes distribuir a Jooble/Talent)
- **Mitigación:**
  - ✅ Backend Express NO se toca en esta migración
  - ✅ Servicios siguen corriendo local/Railway
  - ✅ Frontend llama a backend Express para distribución

---

## 🎯 CRITERIOS DE ÉXITO

### **Migración exitosa si:**

1. ✅ Todos los datos migrados (0 pérdidas)
2. ✅ Frontend funciona con Supabase
3. ✅ RLS protege datos correctamente
4. ✅ Performance igual o mejor (<500ms queries)
5. ✅ Deploy online funcionando
6. ✅ Login/Register funcional
7. ✅ Backend Express sigue corriendo (servicios canales)

### **Migración falla si:**

1. ❌ Pérdida de datos (>1% registros)
2. ❌ RLS permite ver datos ajenos
3. ❌ Performance >2 segundos queries simples
4. ❌ Errores en producción >5% requests
5. ❌ Auth no funciona en producción

---

## 📅 TIMELINE

### **Opción A: Todo en 1 día (8 horas seguidas)**
```
09:00 - 09:30  FASE 1: Setup Supabase
09:30 - 10:30  FASE 2: Migrar schema
10:30 - 11:30  FASE 3: Migrar datos
11:30 - 12:00  FASE 4: Verificar migración
12:00 - 13:00  PAUSA ALMUERZO
13:00 - 15:00  FASE 5: Actualizar frontend
15:00 - 16:00  FASE 6: Row Level Security
16:00 - 17:00  FASE 7: Testing local
17:00 - 17:30  FASE 8: Deploy Vercel
17:30 - 18:00  Buffer / troubleshooting
```

### **Opción B: 2 sesiones (4h + 4h)**
```
DÍA 1 (Backend):
  FASE 1-4: Supabase + migración datos (4 horas)
  Resultado: Datos en Supabase, verificados

DÍA 2 (Frontend):
  FASE 5-8: Frontend + RLS + Deploy (4 horas)
  Resultado: App online con Supabase
```

### **Opción C: 4 sesiones (2h cada una)** ⭐ **RECOMENDADO**
```
SESIÓN 1: Setup + Schema
  FASE 1-2 (2 horas)
  Resultado: Proyecto Supabase + tablas creadas

SESIÓN 2: Migración datos
  FASE 3-4 (2 horas)
  Resultado: Datos migrados y verificados

SESIÓN 3: Frontend + Auth
  FASE 5 (2 horas)
  Resultado: Login funciona con Supabase

SESIÓN 4: RLS + Deploy
  FASE 6-8 (2 horas)
  Resultado: App online protegida
```

---

## 🚀 PRÓXIMOS PASOS INMEDIATOS

### **¿EMPEZAMOS AHORA?**

**Si SÍ:**
1. Te guío en FASE 1 (Setup Supabase - 30 min)
2. Creamos cuenta y obtenemos credenciales
3. Guardamos en .env local

**Si NO:**
1. Te dejo este plan para revisar
2. Cuando quieras, empezamos desde FASE 1
3. Yo te guío paso a paso

**¿Cuál prefieres?**
- **A)** Empezar ahora con FASE 1
- **B)** Revisar plan primero, empezar después
- **C)** Modificar algo del plan antes de empezar

---

**Dime qué prefieres y arrancamos! 🚀**
