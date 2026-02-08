# 🚀 Guía: Levantar Todo en Local

**Puertos:**
- Landing Page: **3000**
- Platform Dashboard (Frontend): **3006**
- Backend API: **3002**

---

## ✅ **ARCHIVOS .env.local CREADOS**

### **1. Landing Page** (`C:\Dev\landing-page\.env.local`)
```
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3006
NEXT_PUBLIC_API_URL=http://localhost:3002
```

### **2. Platform Dashboard** (`C:\Dev\job-platform\frontend\.env.local`)
```
NEXT_PUBLIC_API_URL=http://localhost:3002
NEXT_PUBLIC_LANDING_URL=http://localhost:3000
```

---

## 📋 **PASOS PARA LEVANTAR TODO**

### **Paso 1: Levantar Backend (puerto 3002)**

Abre una terminal:

```powershell
cd C:\Dev\job-platform\backend
npm install
npm run dev
```

**Verificar:**
- Debe mostrar: `✅ API running on http://localhost:3002`
- Abrir: http://localhost:3002/swagger (debe cargar Swagger)

---

### **Paso 2: Levantar Platform Dashboard (puerto 3006)**

Abre **OTRA terminal** (nueva ventana):

```powershell
cd C:\Dev\job-platform\frontend
npm install
npm run dev
```

**Verificar:**
- Debe mostrar: `Ready - started server on 0.0.0.0:3006`
- Abrir: http://localhost:3006 (debe cargar el dashboard)

---

### **Paso 3: Levantar Landing Page (puerto 3000)**

Abre **OTRA terminal** (tercera ventana):

```powershell
cd C:\Dev\landing-page
npm install
npm run dev
```

**Verificar:**
- Debe mostrar: `Ready - started server on 0.0.0.0:3000`
- Abrir: http://localhost:3000 (debe cargar la landing)

---

## 🧪 **VERIFICAR QUE TODO CONECTA**

### **Test 1: Landing → Backend**

1. Abrir: http://localhost:3000
2. Click en "Empezar Ahora" o "Iniciar Sesión"
3. **Debe redirigir a:** http://localhost:3006/login ✅

### **Test 2: Landing → Backend API (Registro)**

1. Abrir: http://localhost:3000/signup
2. Llenar formulario de registro
3. Submit
4. **Debe llamar a:** `http://localhost:3002/api/auth/register` ✅
5. Verificar en consola del backend que recibió la petición

### **Test 3: Platform Dashboard → Backend API**

1. Abrir: http://localhost:3006/login
2. Login con usuario existente o registrar nuevo
3. **Debe llamar a:** `http://localhost:3002/api/auth/login` ✅
4. Después de login, debe cargar dashboard

---

## 🔍 **VERIFICAR CORS EN BACKEND**

El backend debe permitir requests desde:
- `http://localhost:3000` (Landing)
- `http://localhost:3006` (Platform)

**Verificar en:** `backend/index.js` líneas 100-108

```javascript
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3006',
  // ... más
];
```

---

## 🐛 **SI ALGO NO FUNCIONA**

### **Error: "Cannot connect to API"**
- Verificar que el backend está corriendo en puerto 3002
- Verificar `NEXT_PUBLIC_API_URL` en `.env.local`
- Verificar CORS en backend permite el origen

### **Error: "Redirect not working"**
- Verificar que Platform Dashboard está en puerto 3006
- Verificar `NEXT_PUBLIC_FRONTEND_URL` en landing `.env.local`

### **Error: "Port already in use"**
- Cerrar procesos que usen esos puertos
- O cambiar puertos en `package.json`

---

## ✅ **CHECKLIST**

- [ ] Backend corriendo en puerto 3002
- [ ] Platform Dashboard corriendo en puerto 3006
- [ ] Landing Page corriendo en puerto 3000
- [ ] Landing redirige a Platform correctamente
- [ ] Landing puede llamar al Backend API
- [ ] Platform puede llamar al Backend API
- [ ] Login/Registro funciona end-to-end

---

**Una vez que todo funcione en local, entonces pensamos en producción.** ✅

