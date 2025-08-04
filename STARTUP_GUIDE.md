# 🚀 Guía de Arranque - Job Platform

## Prerrequisitos
- Node.js instalado
- npm o pnpm disponible
- Puertos 3002 y 3006 libres

## ⚡ Arranque Rápido

### 1. Backend (Puerto 3002)
```bash
cd backend
npm install
npm start
```
✅ Debería mostrar: "API running on http://localhost:3002"

### 2. Frontend (Puerto 3006)
```bash
cd frontend
npm install
npm run dev
```
✅ Debería mostrar: "Ready in Xs" y ejecutarse en http://localhost:3006

## 🔧 Configuración Frontend
El frontend está configurado para funcionar en el puerto 3006 (no 3004 para evitar conflictos).

**package.json script:**
```json
{
  "scripts": {
    "dev": "next dev -p 3006"
  }
}
```

## 🚨 Solución de Problemas

### Si el frontend no levanta:
1. **Verificar procesos en puertos:**
   ```bash
   netstat -ano | findstr :3006
   netstat -ano | findstr :3002
   ```

2. **Matar procesos conflictivos:**
   ```bash
   wmic process where "ProcessId=XXXX" delete
   ```

3. **Limpiar caché de Next.js:**
   ```bash
   cd frontend
   rm -rf .next
   npm run dev
   ```

### Si hay problemas con Turbo:
- El proyecto funciona con Next.js directo (sin turbo)
- Si necesitas turbo, asegúrate de tener `turbo.json` configurado

### Configuración simplificada de Next.js:
El `next.config.mjs` está simplificado para evitar conflictos:
```javascript
const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};
```

## 📱 URLs de Acceso
- **Frontend:** http://localhost:3006
- **Backend API:** http://localhost:3002
- **Swagger:** http://localhost:3002/swagger

## 🔍 Verificación Rápida
```bash
# Backend
curl http://localhost:3002/

# Frontend
curl http://localhost:3006/
```

## 💡 Notas Importantes
- El frontend puede tardar unos segundos en la primera carga
- Asegúrate de que no haya otros proyectos Next.js ejecutándose
- Si cambias de puerto, actualiza las referencias en:
  - `frontend/package.json` (puerto de desarrollo)
  - `backend/index.js` (configuración CORS allowedOrigins)

## ⚠️ Problemas Conocidos

### Error en sección Conexiones (CORS)
Si la sección de conexiones muestra "Cargando..." infinitamente:

1. **Verificar puertos en CORS:**
   ```javascript
   // En backend/index.js, línea ~21-28
   const allowedOrigins = [
     'http://localhost:3006',  // ← Asegurar que coincida con puerto frontend
     'http://127.0.0.1:3006'   // ← Ambas variantes
   ];
   ```

2. **Reiniciar backend después de cambios:**
   ```bash
   # Matar proceso backend
   netstat -ano | findstr :3002
   wmic process where "ProcessId=XXXX" delete
   
   # Reiniciar
   cd backend && npm start
   ```

3. **Limpiar caché del navegador:**
   - Abrir DevTools (F12)
   - Hacer clic derecho en botón refresh
   - Seleccionar "Empty Cache and Hard Reload"

### Problema de Actualización Automática Solucionado
El sistema ahora incluye **actualización optimista** que:
- ✅ Actualiza la tabla inmediatamente al subir un archivo
- ✅ Muestra los cambios sin esperar la respuesta del servidor
- ✅ Confirma los datos con una segunda llamada al backend
- ✅ Funciona tanto para cargas manuales como sincronizaciones XML/API

**Características mejoradas:**
- La tabla se actualiza instantáneamente cuando procesas un archivo
- Se muestran las nuevas estadísticas (ofertas importadas, errores, etc.)
- El estado cambia a "Activa" y se actualiza la fecha de sincronización
- Después confirma con datos reales del servidor

### Botones Mejorados para Conexiones Manuales
**✅ Problema solucionado:** Ahora las conexiones manuales tienen 2 botones separados:
- **📁 Botón Upload** (icono carpeta): Sube nuevo archivo
- **🔄 Botón Refresh** (icono flecha): Solo actualiza datos desde servidor

**Anteriormente:** El botón refresh abría selector de archivos
**Ahora:** Botones específicos para cada acción

📁 **Botón Upload (icono de subida):** 
- Abre selector de archivos para subir nuevo archivo
- Actualiza automáticamente las estadísticas
- Reemplaza el archivo anterior

🔄 **Botón Refresh (icono de actualización):**
- Solo actualiza el estado de la tabla 
- No abre selector de archivos
- Útil para ver cambios sin cargar nuevo archivo

**Para XML/API:** Un solo botón de sincronización como antes.