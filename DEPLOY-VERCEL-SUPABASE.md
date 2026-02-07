# 🚀 Deploy a Vercel con Supabase PostgreSQL

**Fecha:** 2026-02-07
**Estado:** Listo para deploy

---

## 📋 **PREREQUISITOS COMPLETADOS**

- ✅ Código subido a GitHub: `munozmichael01/dev-job-platform`
- ✅ Backend funcionando con Supabase
- ✅ Frontend funcionando con Supabase
- ✅ Landing page funcionando
- ✅ Datos migrados a Supabase (135 registros)
- ✅ Testing local completado

---

## 🔑 **VARIABLES DE ENTORNO PARA VERCEL**

### **Backend (Node.js/Express)**

**Proyecto Vercel:** `job-platform-backend` (o como lo nombres)

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://bdswyiapdxnxexfzwzhv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_brbj19Bs8N0RQ2E77jEIZA_DaiYN1Eg
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkc3d5aWFwZHhueGV4Znp3emh2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2OTY5OTQ3OCwiZXhwIjoyMDg1Mjc1NDc4fQ.PdkLW0nXq3T6n-QN3Qcw2b2QB2rd-kRZqx6SDW7i5-U
SUPABASE_DB_PASSWORD=pMKbL30XpDPF1d9L

# JWT Secret
JWT_SECRET=tu_jwt_secret_production_aqui_cambiar

# Port (Vercel lo asigna automáticamente)
PORT=3002
```

### **Frontend (Next.js)**

**Proyecto Vercel:** `job-platform-frontend` (o como lo nombres)

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://bdswyiapdxnxexfzwzhv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_brbj19Bs8N0RQ2E77jEIZA_DaiYN1Eg

# Backend API URL (cambiar por URL de Vercel del backend)
NEXT_PUBLIC_API_URL=https://job-platform-backend.vercel.app
```

### **Landing Page (Next.js)**

**Proyecto Vercel:** `job-platform-landing` (o como lo nombres)

```bash
# Backend API URL (cambiar por URL de Vercel del backend)
NEXT_PUBLIC_API_URL=https://job-platform-backend.vercel.app
```

---

## 📂 **ESTRUCTURA DE DEPLOY EN VERCEL**

### **Opción 1: Monorepo (Recomendado)**

Un solo repositorio, 3 proyectos Vercel:

```
GitHub: munozmichael01/dev-job-platform (raíz)
  ├── backend/ → Deploy a Vercel (Node.js)
  ├── frontend/ → Deploy a Vercel (Next.js)
  └── landing-page/ → Deploy a Vercel (Next.js)
```

**Configuración por proyecto en Vercel:**

**Backend:**
- Framework Preset: `Other`
- Build Command: `npm install`
- Output Directory: `.`
- Install Command: `npm install`
- Root Directory: `backend`

**Frontend:**
- Framework Preset: `Next.js`
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`
- Root Directory: `frontend`

**Landing:**
- Framework Preset: `Next.js`
- Build Command: `npm run build`
- Output Directory: `.next`
- Install Command: `npm install`
- Root Directory: `landing-page`

### **Opción 2: Repositorios Separados**

Tres repositorios independientes (más complejo de mantener).

---

## 🎯 **PASOS PARA DEPLOY**

### **1. Deploy Backend**

```bash
# En Vercel Dashboard:
1. New Project
2. Import Git Repository: dev-job-platform
3. Configure Project:
   - Project Name: job-platform-backend
   - Framework: Other
   - Root Directory: backend
4. Environment Variables: (pegar las del backend)
5. Deploy
6. Copiar URL generada: https://job-platform-backend.vercel.app
```

### **2. Deploy Frontend**

```bash
# En Vercel Dashboard:
1. New Project
2. Import Git Repository: dev-job-platform
3. Configure Project:
   - Project Name: job-platform-frontend
   - Framework: Next.js
   - Root Directory: frontend
4. Environment Variables: (pegar las del frontend)
   - NEXT_PUBLIC_API_URL: https://job-platform-backend.vercel.app
5. Deploy
6. Copiar URL generada: https://job-platform-frontend.vercel.app
```

### **3. Deploy Landing Page**

```bash
# En Vercel Dashboard:
1. New Project
2. Import Git Repository: dev-job-platform
3. Configure Project:
   - Project Name: job-platform-landing
   - Framework: Next.js
   - Root Directory: (raíz si landing está en raíz, o landing-page/)
4. Environment Variables: (pegar las del landing)
   - NEXT_PUBLIC_API_URL: https://job-platform-backend.vercel.app
5. Deploy
6. Copiar URL generada: https://job-platform-landing.vercel.app
```

---

## ⚠️ **IMPORTANTE: CORS**

El backend necesita permitir requests desde los dominios de Vercel. Verificar que en `backend/index.js` el CORS esté configurado:

```javascript
const cors = require('cors');

// Configuración CORS para producción
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3006',
  'https://job-platform-frontend.vercel.app',
  'https://job-platform-landing.vercel.app',
  // Agregar dominios custom si los tienes
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

---

## 🧪 **TESTING POST-DEPLOY**

Una vez deployed, verificar:

```bash
# 1. Backend health
curl https://job-platform-backend.vercel.app/

# 2. Login endpoint
curl -X POST https://job-platform-backend.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"superadmin@jobplatform.com","password":"admin123"}'

# 3. Frontend carga
Abrir: https://job-platform-frontend.vercel.app

# 4. Landing carga
Abrir: https://job-platform-landing.vercel.app

# 5. Flujo completo
Landing → Login → Dashboard → Verificar datos cargados desde Supabase
```

---

## 🔒 **SEGURIDAD POST-DEPLOY**

### **1. Cambiar JWT_SECRET**

En Vercel backend, cambiar `JWT_SECRET` a un valor seguro production:

```bash
openssl rand -base64 32
# Usar output como JWT_SECRET
```

### **2. Verificar Row Level Security en Supabase**

Supabase tiene RLS (Row Level Security). Verificar que esté habilitado:

```sql
-- En Supabase SQL Editor:
ALTER TABLE "Users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Campaigns" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Segments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Connections" ENABLE ROW LEVEL SECURITY;

-- Crear políticas según sea necesario
```

### **3. Rotar Service Role Key**

Si es necesario, en Supabase Dashboard → Settings → API:
- Regenerar `service_role` key
- Actualizar en Vercel environment variables

---

## 📊 **MONITOREO POST-DEPLOY**

### **Vercel Dashboard:**
- Logs de deployment
- Runtime logs
- Performance metrics

### **Supabase Dashboard:**
- Database activity
- API usage
- Query performance

---

## 🚨 **TROUBLESHOOTING**

### **Error: "Cannot connect to database"**
- Verificar SUPABASE_SERVICE_ROLE_KEY en Vercel
- Verificar que Supabase project esté activo

### **Error: "CORS policy"**
- Verificar allowedOrigins en backend
- Agregar dominios de Vercel

### **Error: "JWT token invalid"**
- Verificar JWT_SECRET sea el mismo en todas las instancias
- Regenerar token desde login

### **Error: "Function timeout"**
- Vercel Free tier: 10s timeout
- Vercel Pro: 60s timeout
- Optimizar queries lentas

---

## ✅ **CHECKLIST FINAL**

- [ ] Código en GitHub actualizado
- [ ] Backend deployed en Vercel
- [ ] Frontend deployed en Vercel
- [ ] Landing deployed en Vercel
- [ ] Variables de entorno configuradas
- [ ] CORS configurado correctamente
- [ ] JWT_SECRET cambiado a production
- [ ] Login funciona en producción
- [ ] Dashboard carga datos desde Supabase
- [ ] Flujo completo testeado

---

## 🎉 **RESULTADO ESPERADO**

**URLs Production:**
- Landing: https://job-platform-landing.vercel.app
- App: https://job-platform-frontend.vercel.app
- API: https://job-platform-backend.vercel.app

**Datos:**
- Todo conectado a Supabase PostgreSQL cloud
- 135 registros accesibles
- Login funcionando
- Multi-tenant operativo

**Estado:**
- ✅ Production-ready
- ✅ Escalable
- ✅ Sin dependencias locales
- ✅ 100% en la nube
