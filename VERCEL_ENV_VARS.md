# Variables de Entorno para Vercel

## ✅ Backend (dev-job-platform-backend)

### CRÍTICO - CORS Configuration:
```
CORS_ORIGIN=https://dev-job-platform-frontend.vercel.app,https://dev-job-platform-landing.vercel.app
```

### Database (Supabase):
```
NEXT_PUBLIC_SUPABASE_URL=https://bdswyiapdxnxexfzwzhv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkc3d5aWFwZHhueGV4Znp3emh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyODI3MTQsImV4cCI6MjA1Mzg1ODcxNH0.sb_publishable_brbj19Bs8N0RQ2E77jEIZA_DaiYN1Eg
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkc3d5aWFwZHhueGV4Znp3emh2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczODI4MjcxNCwiZXhwIjoyMDUzODU4NzE0fQ.U7NbmxbzLtTG5OEzKNx0XTlW9DHRJ_YnKDqMZG_9qAA
SUPABASE_DB_PASSWORD=pMKbL30XpDPF1d9L
```

### JWT Secret (Important for auth):
```
JWT_SECRET=your_very_secure_random_secret_here_min_32_chars
```

### Encryption (for credentials):
```
ENCRYPTION_KEY=your_32_char_encryption_key_here
```

---

## ✅ Frontend (dev-job-platform-frontend)

### API Backend URL:
```
NEXT_PUBLIC_API_URL=https://dev-job-platform-backend.vercel.app
```

### Supabase (if needed client-side):
```
NEXT_PUBLIC_SUPABASE_URL=https://bdswyiapdxnxexfzwzhv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkc3d5aWFwZHhueGV4Znp3emh2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyODI3MTQsImV4cCI6MjA1Mzg1ODcxNH0.sb_publishable_brbj19Bs8N0RQ2E77jEIZA_DaiYN1Eg
```

### URLs:
```
NEXT_PUBLIC_FRONTEND_URL=https://dev-job-platform-frontend.vercel.app
NEXT_PUBLIC_LANDING_URL=https://dev-job-platform-landing.vercel.app
```

---

## ✅ Landing Page (dev-job-platform-landing)

### NextAuth Configuration:
```
NEXTAUTH_SECRET=mkB7VMMe4tRFEipxXLoxKmBhymJuq+l6lP8VRx4ybOM=
NEXTAUTH_URL=https://dev-job-platform-landing.vercel.app
```

### API Backend URL:
```
NEXT_PUBLIC_API_URL=https://dev-job-platform-backend.vercel.app
```

### Frontend URL (for redirects after login):
```
NEXT_PUBLIC_FRONTEND_URL=https://dev-job-platform-frontend.vercel.app
```

---

## 🔧 Cómo Agregar en Vercel:

1. Ir a cada proyecto en Vercel
2. Settings → Environment Variables
3. Agregar cada variable con su valor
4. Seleccionar "Production", "Preview", "Development" según necesidad
5. Hacer Redeploy después de agregar variables

## ⚠️ CRÍTICO - CORS_ORIGIN en Backend:

Sin esta variable, el backend rechazará todos los requests del frontend de producción.
El error será "Unexpected end of JSON input" porque CORS bloquea la respuesta.

## 📝 Notas:

- Todas las variables NEXT_PUBLIC_* son visibles en el cliente
- JWT_SECRET y ENCRYPTION_KEY deben ser secretos seguros
- SUPABASE_SERVICE_ROLE_KEY nunca debe exponerse al cliente
