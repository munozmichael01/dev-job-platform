# ✅ CONFIGURACIÓN CORRECTA VERCEL

## Settings → General → Build & Development Settings

```
Framework Preset: Next.js

Root Directory: (VACÍO o ".")

Build Command: cd frontend && npm run build
  [ACTIVAR OVERRIDE]

Output Directory: frontend/.next
  [ACTIVAR OVERRIDE]

Install Command: cd frontend && npm ci
  [OVERRIDE YA ACTIVADO ✅]

Development Command: cd frontend && npm run dev
  [ACTIVAR OVERRIDE]
```

## Por qué necesitas esto

Vercel necesita saber que:
1. Instalar dependencias en `frontend/`
2. Ejecutar build en `frontend/`
3. Buscar output en `frontend/.next`

Sin Root Directory configurado, tienes que especificar `cd frontend &&` en cada comando.
