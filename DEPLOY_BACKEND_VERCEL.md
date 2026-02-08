# 🚀 Desplegar Backend a Vercel

## 📋 Pasos para Desplegar Backend

### **1. Crear Nuevo Proyecto para Backend**

1. Ve a: https://vercel.com/new
2. Importa el mismo repositorio: **`dev-job-platform`**
3. Configura:

```
Project Name: dev-job-platform-backend
Framework Preset: Other
Root Directory: backend
```

### **2. Environment Variables del Backend**

Agrega todas estas variables (cópialas de `backend/.env`):

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://bdswyiapdxnxexfzwzhv.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_brbj19Bs8N0RQ2E77jEIZA_DaiYN1Eg
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_DB_PASSWORD=pMKbL30XpDPF1d9L

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-here-change-in-prod

# CORS
CORS_ORIGIN=https://dev-job-platform-frontend.vercel.app

# Node Environment
NODE_ENV=production

# Port (Vercel lo maneja automáticamente)
PORT=3002
```

### **3. Crear vercel.json en backend/**

El backend necesita un archivo de configuración especial:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "index.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "index.js"
    }
  ]
}
```

Este archivo le dice a Vercel cómo ejecutar el backend Node.js/Express.

---

## 🔧 Preparación del Backend

Antes de desplegar, necesitas asegurarte que el backend está listo para producción:

### **Verificar package.json del backend**

Debe tener estos scripts:

```json
{
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### **Verificar index.js**

Debe escuchar en el puerto que Vercel proporciona:

```javascript
const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
```

---

## 📊 Después del Deployment

Una vez que el backend esté desplegado:

1. **Obtén la URL del backend** (ej: `https://dev-job-platform-backend.vercel.app`)

2. **Actualiza el frontend** con la URL real del backend:
   - Ve al proyecto frontend en Vercel
   - Settings → Environment Variables
   - Edita `NEXT_PUBLIC_API_URL` con la URL del backend
   - Redeploy el frontend

3. **Verifica CORS** en el backend:
   - Asegúrate que `CORS_ORIGIN` en el backend incluye la URL del frontend

---

## ✅ Verificación

Prueba estos endpoints del backend:

```bash
# Health check
curl https://dev-job-platform-backend.vercel.app/health

# Login (debe responder con error de credenciales o éxito)
curl -X POST https://dev-job-platform-backend.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'
```

---

## 🚨 Problemas Comunes

**1. "Cannot GET /"**
- Solución: Verifica que `vercel.json` existe en `backend/`

**2. "CORS Error"**
- Solución: Actualiza `CORS_ORIGIN` en variables de entorno

**3. "Database connection failed"**
- Solución: Verifica que las variables de Supabase están correctas

---

## 📝 Checklist Final

- [ ] Frontend desplegado y funcionando
- [ ] Backend desplegado y funcionando
- [ ] Environment variables configuradas
- [ ] CORS configurado correctamente
- [ ] `NEXT_PUBLIC_API_URL` actualizado en frontend
- [ ] Login funciona end-to-end
- [ ] Dashboard carga datos desde Supabase
