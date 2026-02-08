# ✅ Conectar Frontend con Backend

## 🎯 Estado Actual

✅ **Backend desplegado:** Deployment ID `Gi9ZvgG9J` - Ready
✅ **Frontend desplegado:** URL disponible
❌ **Frontend no conecta con backend:** Apunta a localhost:3002

---

## 📋 PASOS PARA CONECTAR

### **1. Obtener URL del Backend**

1. Ve al proyecto **backend** en Vercel Dashboard
2. Haz clic en el deployment `Gi9ZvgG9J` (Ready)
3. Copia la URL completa (será algo como):
   ```
   https://dev-job-platform-backend.vercel.app
   ```
   O puede tener otro formato como:
   ```
   https://dev-job-platform-backend-git-xxx.vercel.app
   ```

### **2. Actualizar Environment Variable en Frontend**

1. Ve al proyecto **frontend** en Vercel Dashboard
2. **Settings** → **Environment Variables**
3. Encuentra `NEXT_PUBLIC_API_URL`
4. Haz clic en **"Edit"**
5. Cambia el valor a la URL del backend (del paso 1)
6. Guarda

### **3. Redeploy Frontend**

1. Ve a **Deployments** tab del frontend
2. Haz clic en **"Redeploy"**
3. Espera 2-3 minutos

---

## ✅ Verificación

Una vez que el frontend redeploy termine:

1. **Accede a tu frontend:** `https://dev-job-platform-frontend.vercel.app/login`
2. **Intenta hacer login** con:
   - Email: `test.new.user@example.com`
   - Password: `password123`
3. Debería funcionar correctamente ✅

---

## 🔧 Verificar Backend Funciona

Puedes probar el backend directamente:

```bash
# Reemplaza con tu URL real del backend
curl https://dev-job-platform-backend.vercel.app/api/auth/login \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test.new.user@example.com","password":"password123"}'
```

Debería devolver un JSON con el token si las credenciales son correctas.

---

## 📊 URLs Finales

Después de completar estos pasos tendrás:

```
Frontend: https://dev-job-platform-frontend.vercel.app
Backend:  https://dev-job-platform-backend.vercel.app
Landing:  https://job-platform-landing.vercel.app (ya desplegado)
```

---

## 🎉 Sistema Completo en la Nube

✅ Frontend → Vercel
✅ Backend → Vercel
✅ Database → Supabase PostgreSQL
✅ Landing → Vercel

Todo funcionando en producción 🚀
