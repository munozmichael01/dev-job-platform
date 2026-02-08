# 🚀 DEPLOY ONLINE - SOLUCIÓN COMPLETA

**Fecha:** 2025-01-29
**Estado Actual:** Proyecto local funcionando, Vercel con error 404

---

## 📊 ESTADO ACTUAL DEL PROYECTO

### ✅ **LOCAL (Funcionando):**

| Componente | Puerto | Estado | URL Local |
|------------|--------|--------|-----------|
| **Backend** | 3002 | ✅ Corriendo | http://localhost:3002 |
| **Frontend** | 3006 | ⏳ Iniciando | http://localhost:3006 |
| **Landing** | 3000 | ⏳ Iniciando | http://localhost:3000 |
| **SQL Server** | 1433 | ⚠️ Certificado | localhost:1433 |

### ❌ **PROBLEMAS DETECTADOS:**

1. **SQL Server:** Error de certificado self-signed
   - Error: `DEPTH_ZERO_SELF_SIGNED_CERT`
   - Solución temporal: Agregar `trustServerCertificate: true` en config

2. **Vercel 404:**
   - Landing page configurada correctamente ✅
   - Frontend (job-platform) solo tiene frontend, **falta backend** ❌
   - Backend necesita servicio serverless o API Routes

---

## 🏗️ ARQUITECTURA ACTUAL

```
GitHub:
├── munozmichael01/landing-page (OK - solo frontend Next.js)
└── munozmichael01/dev-job-platform (PROBLEMA - tiene frontend + backend)

Local:
├── C:/Dev/landing-page/ (Next.js standalone)
└── C:/Dev/job-platform/
    ├── frontend/ (Next.js)
    └── backend/ (Node.js + Express + SQL Server)

Vercel:
├── Landing: https://[tu-url].vercel.app (OK)
└── Job Platform: ERROR 404 (backend no desplegado)
```

---

## 🎯 SOLUCIONES DISPONIBLES

### **OPCIÓN 1: VERCEL MONOREPO (Recomendada para MVP rápido)**

**Pros:**
- Todo en un solo deploy
- Gratis para hobby/personal
- Frontend automático
- Backend como serverless functions

**Cons:**
- Necesitas migrar BD a cloud (Azure SQL / Supabase)
- Límites en serverless functions (10s timeout)

**Pasos:**

#### **1.1 Configurar Vercel para Monorepo**

```json
// vercel.json (raíz del proyecto)
{
  "version": 2,
  "builds": [
    {
      "src": "frontend/package.json",
      "use": "@vercel/next"
    },
    {
      "src": "backend/api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/backend/api/$1"
    },
    {
      "src": "/(.*)",
      "dest": "/frontend/$1"
    }
  ]
}
```

#### **1.2 Reestructurar Backend para Serverless**

Crear `backend/api/` con endpoints individuales:

```
backend/
├── api/
│   ├── auth.js        // POST /api/auth/login, /register
│   ├── campaigns.js   // GET/POST /api/campaigns
│   ├── offers.js      // GET/POST /api/job-offers
│   └── metrics.js     // GET /api/metrics
├── src/
│   ├── services/
│   ├── db/
│   └── middleware/
└── package.json
```

**Ejemplo `backend/api/auth.js`:**
```javascript
const db = require('../src/db/db');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    const { email, password } = req.body;
    // Lógica de login
    res.json({ token: 'xxx' });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
};
```

#### **1.3 Migrar BD a Azure SQL (Gratis)**

**Azure SQL Database Free Tier:**
- 32 GB storage
- 5 DTUs (suficiente para MVP)
- 100% gratis

**Pasos:**
1. Crear cuenta Azure (requiere tarjeta pero no cobra)
2. Crear Azure SQL Database (tier: Basic)
3. Exportar BD local con SQL Server Management Studio
4. Importar a Azure SQL
5. Actualizar connection string en Vercel

**Variables de entorno en Vercel:**
```env
DB_SERVER=your-server.database.windows.net
DB_DATABASE=JobPlatform
DB_USER=adminuser
DB_PASSWORD=YourSecurePassword123!
JWT_SECRET=production-secret-key-change-this
```

---

### **OPCIÓN 2: VERCEL (Frontend) + RENDER/RAILWAY (Backend)**

**Pros:**
- Separación clara frontend/backend
- Backend puede tener procesos long-running
- BD puede ser PostgreSQL en Railway (gratis)

**Cons:**
- 2 servicios separados para gestionar
- Necesitas configurar CORS

**Arquitectura:**

```
Frontend (Vercel):
- https://job-platform.vercel.app
- Next.js estático
- Llama a API_URL

Backend (Render/Railway):
- https://job-platform-api.onrender.com
- Node.js + Express
- PostgreSQL incluido (Railway) o Azure SQL
```

**Pasos:**

#### **2.1 Deploy Backend en Railway**

1. Crear cuenta en [railway.app](https://railway.app)
2. "New Project" → "Deploy from GitHub"
3. Seleccionar `munozmichael01/dev-job-platform`
4. Railway detecta Node.js automáticamente
5. Configurar variables de entorno
6. Railway provee PostgreSQL gratis (500 MB)

**Variables en Railway:**
```env
DATABASE_URL=postgresql://...  (Railway lo provee automáticamente)
JWT_SECRET=production-secret
PORT=3002
```

#### **2.2 Migrar de SQL Server a PostgreSQL**

**Instalar pg en lugar de mssql:**
```bash
cd backend
npm uninstall mssql
npm install pg
```

**Actualizar `backend/src/db/db.js`:**
```javascript
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

module.exports = {
  query: async (text, params) => {
    const result = await pool.query(text, params);
    return result.rows;
  }
};
```

**Convertir queries SQL Server → PostgreSQL:**
- `@param` → `$1, $2, $3`
- `GETDATE()` → `NOW()`
- `NVARCHAR(MAX)` → `TEXT`
- `DATETIME2` → `TIMESTAMP`

#### **2.3 Deploy Frontend en Vercel**

**Actualizar `frontend/.env.production`:**
```env
NEXT_PUBLIC_API_URL=https://job-platform-api.railway.app
```

**Vercel detecta automáticamente Next.js:**
1. Conectar repo GitHub
2. Auto-deploy en cada push a main

---

### **OPCIÓN 3: TODO EN RAILWAY (Más simple)**

**Pros:**
- 1 solo servicio
- PostgreSQL incluido gratis
- Monorepo soportado
- No necesitas separar frontend/backend

**Cons:**
- Menos familiar que Vercel para Next.js
- Límites en tier gratuito (500 horas/mes)

**Pasos:**

1. **Push monorepo a GitHub**
2. **Railway New Project → Deploy from GitHub**
3. **Railway detecta:**
   - `frontend/` → Next.js
   - `backend/` → Node.js
4. **Railway provee:**
   - URL frontend: `https://job-platform-production.up.railway.app`
   - URL backend: `https://job-platform-production.up.railway.app/api`
   - PostgreSQL incluido

**Configuración Railway:**
```toml
# railway.toml
[build]
builder = "nixpacks"

[deploy]
startCommand = "npm run start:all"
```

**Package.json raíz:**
```json
{
  "scripts": {
    "start:all": "concurrently \"npm run start:backend\" \"npm run start:frontend\"",
    "start:backend": "cd backend && node index.js",
    "start:frontend": "cd frontend && npm run start"
  }
}
```

---

## 🎯 RECOMENDACIÓN FINAL

### **Para ti (MVP rápido, sin migrar BD aún):**

**OPCIÓN 2: Vercel + Railway**

**Razones:**
1. **Frontend en Vercel** (ya conoces la plataforma)
2. **Backend en Railway** (incluye PostgreSQL gratis, fácil setup)
3. **Migración gradual** (puedes migrar datos de SQL Server a PostgreSQL en Railway)
4. **Sin costos** (ambos tienen tier gratuito generoso)

**Timeline estimado:**
- ⏱️ **1 hora:** Crear cuenta Railway + conectar repo
- ⏱️ **2 horas:** Migrar backend de SQL Server a PostgreSQL
- ⏱️ **30 min:** Configurar variables entorno en Railway
- ⏱️ **30 min:** Actualizar frontend para llamar a Railway API
- ⏱️ **30 min:** Migrar datos de producción

**Total: ~4-5 horas** para tener todo online

---

## 🚀 PASO A PASO INMEDIATO

### **Paso 1: Arreglar SQL Server local (ahora)**

```javascript
// backend/src/db/db.js - Agregar línea 13:
const config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || 'JobPlatform',
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: true, // ← AGREGAR ESTA LÍNEA
    enableArithAbort: true
  }
};
```

**Guardar y reiniciar backend:**
```bash
# Matar proceso actual
Ctrl+C en terminal backend

# Reiniciar
cd C:/Dev/job-platform/backend
node index.js
```

---

### **Paso 2: Verificar proyecto local (5 minutos)**

1. **Backend:** http://localhost:3002 → Debería responder sin error SQL
2. **Frontend:** http://localhost:3006 → Debería cargar login
3. **Landing:** http://localhost:3000 → Debería cargar homepage

---

### **Paso 3: Crear cuenta Railway (10 minutos)**

1. Ir a https://railway.app
2. "Start a New Project"
3. "Deploy from GitHub Repo"
4. Autorizar GitHub
5. Seleccionar `munozmichael01/dev-job-platform`

---

### **Paso 4: Configurar Railway (1 hora)**

**Variables de entorno necesarias:**

```env
# Base de datos (Railway provee automáticamente)
DATABASE_URL=postgresql://postgres:password@containers-us-west-123.railway.app:5432/railway

# JWT
JWT_SECRET=tu-secret-seguro-aqui-cambiar-en-produccion

# Puerto
PORT=3002

# Frontend URL (para CORS)
FRONTEND_URL=https://job-platform.vercel.app

# Otros
NODE_ENV=production
```

**Comandos build en Railway:**
```bash
# Root Directory: /backend
# Build Command: npm install
# Start Command: node index.js
```

---

### **Paso 5: Migrar queries a PostgreSQL (2 horas)**

Ver archivo adjunto `MIGRACION_SQL_SERVER_A_POSTGRESQL.md` con:
- Conversión automática de queries
- Schema differences
- Data migration script

---

### **Paso 6: Deploy frontend en Vercel (30 minutos)**

```bash
# 1. Instalar Vercel CLI
npm i -g vercel

# 2. Deploy desde frontend/
cd C:/Dev/job-platform/frontend
vercel

# 3. Configurar variables de entorno en Vercel dashboard:
NEXT_PUBLIC_API_URL=https://job-platform-production.up.railway.app
```

---

## 📊 COMPARATIVA OPCIONES

| Criterio | Vercel Monorepo | Vercel + Railway | Todo Railway |
|----------|----------------|------------------|--------------|
| **Complejidad setup** | Media (serverless) | Baja | Muy baja |
| **Costo** | Gratis | Gratis | Gratis |
| **BD incluida** | ❌ No | ✅ PostgreSQL | ✅ PostgreSQL |
| **Migración BD** | Azure SQL | PostgreSQL | PostgreSQL |
| **Performance** | Alta (CDN) | Alta | Media |
| **Long-running tasks** | ❌ No (10s limit) | ✅ Sí | ✅ Sí |
| **Escalabilidad** | Alta | Alta | Media |
| **Familiaridad** | Alta (Vercel) | Media | Baja |

---

## ❓ DECISIONES PENDIENTES

Antes de continuar, necesito que decidas:

### **1. ¿Quieres migrar de SQL Server a PostgreSQL?**
- ✅ **Sí** → Opción 2 o 3 (Railway con PostgreSQL gratis)
- ❌ **No** → Opción 1 (Vercel + Azure SQL, requiere cuenta Azure)

### **2. ¿Prefieres todo en un sitio o separado?**
- **Separado** → Opción 2 (Vercel frontend + Railway backend) ← **Recomendado**
- **Junto** → Opción 3 (Todo en Railway)

### **3. ¿Cuándo quieres hacerlo?**
- **Ahora mismo** → Empezamos con Railway setup
- **Más tarde** → Te dejo script automatizado para migración

---

## 📝 PRÓXIMOS PASOS

**Responde estas preguntas:**

1. ¿PostgreSQL está bien o necesitas mantener SQL Server?
2. ¿Vercel + Railway o todo en Railway?
3. ¿Empezamos ahora o prefieres script para hacerlo tú?

**Una vez decidas, te guío paso a paso con comandos exactos.**

---

## 🔧 TROUBLESHOOTING

### **Error 404 en Vercel actual**

**Causa:** Vercel solo ve `frontend/` pero las rutas esperan `/api/*` que vienen del backend.

**Solución temporal:**
```bash
# Apuntar frontend local a backend local
# frontend/.env.local:
NEXT_PUBLIC_API_URL=http://localhost:3002
```

**Solución definitiva:** Deploy backend en Railway (Opción 2)

---

**¿Cuál opción prefieres? Te ayudo con el deploy paso a paso.**
