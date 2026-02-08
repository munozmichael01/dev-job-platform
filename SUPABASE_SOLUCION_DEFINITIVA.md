# 🚀 SUPABASE - SOLUCIÓN DEFINITIVA PARA BACKEND + BD

**Fecha:** 2025-01-29
**Recomendación:** ⭐⭐⭐⭐⭐ MEJOR OPCIÓN para tu proyecto

---

## 🎯 POR QUÉ SUPABASE ES LA MEJOR OPCIÓN

### ✅ **Ventajas vs otras opciones:**

| Característica | Supabase | Railway | Vercel Serverless |
|----------------|----------|---------|-------------------|
| **PostgreSQL incluido** | ✅ 500MB gratis | ✅ 500MB gratis | ❌ No incluye |
| **API REST automática** | ✅ Auto-generada | ❌ Manual | ❌ Manual |
| **Auth incluido** | ✅ JWT + OAuth | ❌ Manual | ❌ Manual |
| **Realtime** | ✅ WebSockets | ❌ No | ❌ No |
| **Storage** | ✅ 1GB gratis | ❌ No | ❌ No |
| **Dashboard admin** | ✅ Excelente | 🟡 Básico | ❌ No |
| **Edge Functions** | ✅ Deno runtime | ❌ No | ✅ Sí |
| **Costo** | **GRATIS** | Gratis (límites) | Gratis (límites) |
| **Migración desde SQL Server** | 🟡 Media | 🟡 Media | 🔴 Difícil |
| **Compatibilidad código actual** | 🟢 Alta (95%) | 🟢 Alta (95%) | 🔴 Baja (50%) |

---

## 🏗️ ARQUITECTURA CON SUPABASE

```
┌─────────────────────────────────────────────────────────┐
│                     VERCEL (Frontend)                    │
│              https://job-platform.vercel.app             │
│                      Next.js App                         │
└────────────────────┬────────────────────────────────────┘
                     │
                     │ API calls
                     ▼
┌─────────────────────────────────────────────────────────┐
│                  SUPABASE (Backend + BD)                 │
│          https://[tu-proyecto].supabase.co               │
├─────────────────────────────────────────────────────────┤
│  📊 PostgreSQL Database (500MB gratis)                   │
│  🔐 Auth (JWT + OAuth + Email)                           │
│  📡 Realtime (WebSockets para métricas live)             │
│  💾 Storage (1GB para archivos CSV/XML)                  │
│  ⚡ Edge Functions (Serverless Deno)                     │
│  📊 Dashboard Admin (SQL Editor, Table Editor)           │
└─────────────────────────────────────────────────────────┘
```

---

## 🎁 LO QUE SUPABASE TE DA GRATIS

### **1. PostgreSQL Database (500MB)**
- Base de datos completa
- Backups automáticos diarios
- Point-in-time recovery
- SQL Editor visual
- Table editor drag-and-drop

### **2. Auth Built-in**
- ✅ Email/password (lo que ya usas)
- ✅ Magic links
- ✅ OAuth (Google, GitHub, LinkedIn, etc.)
- ✅ JWT tokens automáticos
- ✅ Row Level Security (RLS)

**Significa:** Puedes ELIMINAR todo tu código de auth backend, Supabase lo hace por ti.

### **3. API REST Auto-generada**
Supabase crea automáticamente endpoints REST para cada tabla:

```javascript
// ANTES (tu código actual):
app.get('/api/campaigns', async (req, res) => {
  const result = await db.query('SELECT * FROM Campaigns WHERE UserId = ?', [userId]);
  res.json(result);
});

// DESPUÉS (con Supabase):
const { data } = await supabase
  .from('Campaigns')
  .select('*')
  .eq('UserId', userId);
```

### **4. Realtime (WebSockets)**
```javascript
// Escuchar cambios en tabla Campaigns en tiempo real:
supabase
  .channel('campaigns')
  .on('postgres_changes',
    { event: '*', schema: 'public', table: 'Campaigns' },
    (payload) => {
      console.log('🔄 Campaña actualizada:', payload);
      // Auto-refresh dashboard sin polling
    }
  )
  .subscribe();
```

### **5. Storage (1GB)**
```javascript
// Subir XML feeds directamente a Supabase Storage
const { data } = await supabase.storage
  .from('xml-feeds')
  .upload('conexion-2089.xml', xmlFile);

// URL pública: https://[proyecto].supabase.co/storage/v1/object/public/xml-feeds/conexion-2089.xml
```

---

## 🔄 MIGRACIÓN DE TU CÓDIGO ACTUAL

### **Cambios necesarios (95% compatible):**

#### **1. Autenticación → Usar Supabase Auth**

**ANTES (backend/src/routes/auth.js):**
```javascript
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  // Verificar usuario en BD
  const user = await db.query('SELECT * FROM Users WHERE Email = ?', [email]);

  // Comparar password
  const valid = await bcrypt.compare(password, user.PasswordHash);

  // Crear token JWT
  const token = jwt.sign({ userId: user.UserId }, process.env.JWT_SECRET);

  res.json({ token, user });
});
```

**DESPUÉS (frontend con Supabase):**
```javascript
// Supabase maneja TODO esto automáticamente
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'user@example.com',
  password: 'password123'
});

// data.user → Info del usuario
// data.session.access_token → JWT token automático
```

**Beneficios:**
- ❌ Eliminas 200+ líneas de código auth backend
- ❌ No más bcrypt, jwt, password hashing manual
- ✅ Auth desde frontend directamente
- ✅ Tokens refresh automáticos
- ✅ Session management incluido

---

#### **2. Queries → Usar Supabase Client**

**ANTES (backend SQL Server):**
```javascript
const { pool } = require('./db/db');

app.get('/api/campaigns', async (req, res) => {
  const result = await pool.request()
    .input('userId', sql.Int, req.user.userId)
    .query('SELECT * FROM Campaigns WHERE UserId = @userId AND StatusId = 1');

  res.json(result.recordset);
});
```

**DESPUÉS (frontend con Supabase):**
```javascript
// Desde frontend directamente (sin backend):
const { data: campaigns } = await supabase
  .from('Campaigns')
  .select('*')
  .eq('UserId', user.id)
  .eq('StatusId', 1);

// campaigns → Array de campañas listas para usar
```

**Beneficios:**
- ✅ Queries desde frontend directamente
- ✅ Row Level Security protege datos automáticamente
- ✅ Realtime updates gratis
- ❌ No necesitas backend Express para queries simples

---

#### **3. Lógica Compleja → Edge Functions**

Para lógica que NO puede ir en frontend (procesamiento XML, sync con Jooble, etc.):

**Supabase Edge Functions (Deno):**
```typescript
// supabase/functions/sync-turijobs/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_KEY')!
  );

  // Fetch desde Turijobs
  const response = await fetch('https://api.turijobs.com/api/v1/job-offers/export');
  const data = await response.json();

  // Insertar en Supabase
  const { error } = await supabase
    .from('JobOffers')
    .upsert(data.offers);

  return new Response(JSON.stringify({ success: !error }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

**Invocar desde frontend:**
```javascript
const { data } = await supabase.functions.invoke('sync-turijobs');
```

---

## 🛠️ PLAN DE MIGRACIÓN PASO A PASO

### **Fase 1: Setup Supabase (30 minutos)**

#### **1.1 Crear proyecto Supabase**
1. Ir a https://supabase.com
2. "Start your project" (gratis, no requiere tarjeta)
3. Crear nuevo proyecto:
   - **Name:** job-platform
   - **Database Password:** (guardar en .env)
   - **Region:** Europe West (London) - más cercano a España

#### **1.2 Obtener credenciales**
```env
# frontend/.env.local
NEXT_PUBLIC_SUPABASE_URL=https://[tu-proyecto].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Para edge functions (privado):
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

### **Fase 2: Migrar Schema SQL Server → PostgreSQL (1 hora)**

#### **2.1 Exportar schema actual**
```sql
-- Script para generar CREATE TABLEs de SQL Server
SELECT
    'CREATE TABLE ' + t.name + ' (' + CHAR(13) +
    STUFF((
        SELECT ',' + CHAR(13) +
            '  ' + c.name + ' ' +
            TYPE_NAME(c.user_type_id) +
            CASE
                WHEN TYPE_NAME(c.user_type_id) IN ('varchar', 'nvarchar', 'char', 'nchar')
                THEN '(' + CAST(c.max_length AS VARCHAR) + ')'
                ELSE ''
            END
        FROM sys.columns c
        WHERE c.object_id = t.object_id
        FOR XML PATH('')
    ), 1, 1, '') + CHAR(13) + ');'
FROM sys.tables t
WHERE t.type = 'U';
```

#### **2.2 Convertir a PostgreSQL**
Usar herramienta online: https://www.sqlines.com/online

**Conversiones automáticas:**
- `NVARCHAR(MAX)` → `TEXT`
- `DATETIME2` → `TIMESTAMP`
- `BIT` → `BOOLEAN`
- `IDENTITY(1,1)` → `SERIAL`
- `GETDATE()` → `NOW()`

#### **2.3 Ejecutar en Supabase SQL Editor**
1. Supabase Dashboard → SQL Editor
2. Pegar schema convertido
3. Run → Crear todas las tablas

---

### **Fase 3: Migrar Datos (1-2 horas)**

#### **Opción A: Script automático (recomendado)**

**Script Node.js para migrar:**
```javascript
// migrate-to-supabase.js
const sql = require('mssql');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const sqlConfig = {
  server: 'localhost',
  database: 'JobPlatform',
  user: 'jobplatform',
  password: 'JobPlatform2025!',
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

async function migrateTables() {
  const pool = await sql.connect(sqlConfig);

  // Lista de tablas a migrar (en orden de dependencias)
  const tables = [
    'Users',
    'Channels',
    'JobOffers',
    'Campaigns',
    'CampaignOffers',
    'CampaignChannels',
    'Segments',
    'UserChannelCredentials'
  ];

  for (const table of tables) {
    console.log(`🔄 Migrando tabla ${table}...`);

    // 1. Obtener datos de SQL Server
    const result = await pool.request().query(`SELECT * FROM ${table}`);
    const rows = result.recordset;

    if (rows.length === 0) {
      console.log(`⏭️  ${table} vacía, saltando...`);
      continue;
    }

    // 2. Insertar en Supabase en batches de 1000
    const batchSize = 1000;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);

      const { error } = await supabase
        .from(table)
        .insert(batch);

      if (error) {
        console.error(`❌ Error en ${table}:`, error);
      } else {
        console.log(`✅ ${table}: ${batch.length} registros migrados`);
      }
    }
  }

  console.log('🎉 Migración completada!');
  await pool.close();
}

migrateTables();
```

**Ejecutar:**
```bash
cd C:/Dev/job-platform/backend
npm install @supabase/supabase-js
node migrate-to-supabase.js
```

#### **Opción B: Export/Import CSV**
1. SQL Server Management Studio → Export to CSV
2. Supabase Dashboard → Table Editor → Import CSV

---

### **Fase 4: Actualizar Frontend (2 horas)**

#### **4.1 Instalar Supabase Client**
```bash
cd C:/Dev/job-platform/frontend
npm install @supabase/supabase-js
```

#### **4.2 Crear Supabase Client**
```typescript
// frontend/lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

#### **4.3 Migrar Auth Context**

**ANTES (AuthContext.tsx - 200 líneas):**
```typescript
// Lógica manual de login/logout/refresh
const login = async (email, password) => {
  const response = await fetch('http://localhost:3002/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password })
  });
  // ... manejo manual de tokens, refresh, etc.
};
```

**DESPUÉS (AuthContext.tsx - 50 líneas):**
```typescript
import { supabase } from '@/lib/supabase';

const login = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) throw error;

  setUser(data.user);
  setSession(data.session);
};

const logout = async () => {
  await supabase.auth.signOut();
  setUser(null);
  setSession(null);
};

// Session auto-refresh (Supabase lo hace automáticamente)
useEffect(() => {
  supabase.auth.onAuthStateChange((event, session) => {
    setSession(session);
    setUser(session?.user ?? null);
  });
}, []);
```

#### **4.4 Migrar API Calls**

**ANTES (useAuthFetch.ts):**
```typescript
const response = await fetch(`${API_URL}/api/campaigns`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

**DESPUÉS:**
```typescript
const { data: campaigns, error } = await supabase
  .from('Campaigns')
  .select('*')
  .eq('UserId', user.id);
```

---

### **Fase 5: Row Level Security (RLS) - CRÍTICO (1 hora)**

Supabase permite que frontend acceda directamente a BD, **pero necesitas RLS para proteger datos:**

#### **5.1 Habilitar RLS en todas las tablas**
```sql
-- En Supabase SQL Editor:
ALTER TABLE "Campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobOffers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CampaignOffers" ENABLE ROW LEVEL SECURITY;
-- ... para todas las tablas
```

#### **5.2 Crear políticas de acceso**

**Ejemplo: Tabla Campaigns**
```sql
-- Policy: Users solo ven sus propias campañas
CREATE POLICY "Users can view own campaigns"
ON "Campaigns"
FOR SELECT
USING (auth.uid() = "UserId");

-- Policy: Users solo pueden insertar campañas propias
CREATE POLICY "Users can insert own campaigns"
ON "Campaigns"
FOR INSERT
WITH CHECK (auth.uid() = "UserId");

-- Policy: Users solo pueden actualizar sus campañas
CREATE POLICY "Users can update own campaigns"
ON "Campaigns"
FOR UPDATE
USING (auth.uid() = "UserId");

-- Policy: Users solo pueden eliminar sus campañas
CREATE POLICY "Users can delete own campaigns"
ON "Campaigns"
FOR DELETE
USING (auth.uid() = "UserId");
```

**Repetir para todas las tablas con UserId.**

---

### **Fase 6: Edge Functions para Lógica Compleja (2 horas)**

#### **6.1 Instalar Supabase CLI**
```bash
npm install -g supabase
supabase login
```

#### **6.2 Inicializar proyecto**
```bash
cd C:/Dev/job-platform
supabase init
```

#### **6.3 Crear Edge Function para Sync Jooble**
```bash
supabase functions new sync-jooble
```

**supabase/functions/sync-jooble/index.ts:**
```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_KEY')!
  );

  // Obtener campañas activas
  const { data: campaigns } = await supabase
    .from('Campaigns')
    .select('*, CampaignChannels(*)')
    .eq('StatusId', 1);

  // Sync con Jooble API
  for (const campaign of campaigns || []) {
    const joobleResponse = await fetch(
      `https://jooble.org/api/${campaign.joobleApiKey}`,
      {
        method: 'POST',
        body: JSON.stringify({
          CampaignName: campaign.Name,
          Status: campaign.StatusId,
          // ... resto del payload
        })
      }
    );

    // Actualizar métricas
    const metrics = await joobleResponse.json();

    await supabase
      .from('CampaignChannels')
      .update({
        ActualSpend: metrics.spend,
        ActualClicks: metrics.clicks,
        ActualApplications: metrics.applications
      })
      .eq('CampaignId', campaign.CampaignId)
      .eq('ChannelId', 'jooble');
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' }
  });
});
```

#### **6.4 Deploy Edge Function**
```bash
supabase functions deploy sync-jooble
```

#### **6.5 Programar CRON (cada 5 minutos)**
En Supabase Dashboard → Database → Extensions → pg_cron:
```sql
SELECT cron.schedule(
  'sync-jooble-metrics',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://[tu-proyecto].supabase.co/functions/v1/sync-jooble',
    headers := '{"Authorization": "Bearer ' || current_setting('app.settings.service_key') || '"}'::jsonb
  );
  $$
);
```

---

## 🚀 VENTAJAS FINALES DE USAR SUPABASE

### **1. Código más simple**
- **ANTES:** 5,000+ líneas backend (auth, db, APIs)
- **DESPUÉS:** 500 líneas edge functions (solo lógica compleja)

### **2. Deployment automático**
```bash
# Deploy frontend a Vercel (como siempre):
cd frontend
vercel

# Deploy edge functions a Supabase:
supabase functions deploy

# LISTO - No necesitas Railway, Render, ni nada más
```

### **3. Realtime gratis**
```typescript
// Dashboard actualiza métricas en tiempo real sin polling:
supabase
  .channel('metrics')
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'CampaignChannels' },
    (payload) => {
      // Auto-update UI sin refrescar página
      updateMetrics(payload.new);
    }
  )
  .subscribe();
```

### **4. Storage para archivos**
```typescript
// Subir XML feeds a Supabase Storage:
const { data } = await supabase.storage
  .from('xml-feeds')
  .upload(`conexion-${connectionId}.xml`, xmlFile);

// URL pública automática
const url = supabase.storage
  .from('xml-feeds')
  .getPublicUrl(`conexion-${connectionId}.xml`);
```

---

## 📊 COMPARATIVA FINAL

| Aspecto | SQL Server + Express Backend | Supabase |
|---------|------------------------------|----------|
| **Líneas de código** | ~5,000 líneas backend | ~500 líneas edge functions |
| **Auth** | Manual (200 líneas) | Automático (0 líneas) |
| **APIs REST** | Manual (50+ endpoints) | Auto-generadas |
| **Realtime** | Manual (WebSockets) | Incluido gratis |
| **Storage** | Manual (filesystem) | Incluido gratis (1GB) |
| **Deploy** | 2 deploys (Vercel + Railway) | 1 deploy (Vercel + Supabase) |
| **Costo** | $0 (tier gratuito) | $0 (tier gratuito) |
| **Escalabilidad** | Manual | Automática |
| **Backups** | Manual | Automático diario |
| **Admin Dashboard** | No incluido | Incluido |

---

## ✅ DECISIÓN FINAL: SUPABASE

**Mi recomendación clara:**

### **🎯 Stack final:**
```
Frontend: Vercel (Next.js)
Backend + BD: Supabase (PostgreSQL + Auth + Edge Functions)
```

**Beneficios:**
- ✅ **50% menos código** (eliminas todo el backend Express)
- ✅ **Deploy más simple** (solo Vercel + Supabase)
- ✅ **Gratis para siempre** (tier gratuito generoso)
- ✅ **Realtime incluido** (métricas actualizan automáticamente)
- ✅ **Auth automático** (eliminas 200 líneas de código)
- ✅ **API REST auto-generada** (eliminas 50+ endpoints)

---

## 🚀 PRÓXIMOS PASOS

**¿Quieres que empecemos la migración a Supabase?**

**Plan de trabajo:**
1. ⏱️ **30 min:** Crear proyecto Supabase + setup inicial
2. ⏱️ **1 hora:** Migrar schema SQL Server → PostgreSQL
3. ⏱️ **1 hora:** Migrar datos con script automático
4. ⏱️ **2 horas:** Actualizar frontend para usar Supabase client
5. ⏱️ **1 hora:** Configurar Row Level Security (RLS)
6. ⏱️ **2 horas:** Migrar lógica compleja a Edge Functions

**Total: ~7-8 horas** (puedo ayudarte paso a paso)

**¿Empezamos ahora o prefieres que te deje scripts para hacerlo después?**
