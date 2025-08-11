@echo off
echo 🚀 INICIANDO JOB PLATFORM - ARQUITECTURA SARGABLE
echo.
echo ⏳ Verificando puertos...
netstat -ano | findstr :3002 >nul
if %errorlevel% == 0 (
    echo ❌ Puerto 3002 ocupado. Mata el proceso antes de continuar.
    echo    Use: netstat -ano ^| findstr :3002
    pause
    exit /b 1
)

netstat -ano | findstr :3006 >nul
if %errorlevel% == 0 (
    echo ❌ Puerto 3006 ocupado. Mata el proceso antes de continuar.
    echo    Use: netstat -ano ^| findstr :3006
    pause
    exit /b 1
)

echo ✅ Puertos libres. Continuando...
echo.

echo 🔧 INICIANDO BACKEND (Puerto 3002)...
start "Backend-SARGable" cmd /k "cd backend && echo 🚀 SERVIDOR BACKEND SARGABLE... && node index_sargable.js"

echo ⏳ Esperando 3 segundos para que el backend se inicie...
timeout /t 3 /nobreak >nul

echo 🌐 INICIANDO FRONTEND (Puerto 3006)...
start "Frontend-NextJS" cmd /k "cd frontend && echo 🎯 INICIANDO FRONTEND... && npm run dev"

echo.
echo ✅ SERVIDORES INICIADOS:
echo 🔧 Backend: http://localhost:3002
echo 🌐 Frontend: http://localhost:3006
echo.
echo 📋 URLs PRINCIPALES:
echo • Dashboard: http://localhost:3006/
echo • Ofertas: http://localhost:3006/ofertas
echo • Conexiones: http://localhost:3006/conexiones
echo.
echo 🎉 ¡Listo para usar!
echo Presiona cualquier tecla para salir...
pause >nul
