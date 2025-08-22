@echo off
echo 🚀 INICIANDO JOB PLATFORM - ARQUITECTURA COMPLETA (CORREGIDA)
echo.
echo ⏳ Verificando puertos...
netstat -ano | findstr :3000 >nul
if %errorlevel% == 0 (
    echo ❌ Puerto 3000 ocupado. Mata el proceso antes de continuar.
    echo    Use: netstat -ano ^| findstr :3000
    pause
    exit /b 1
)

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

echo 🌍 INICIANDO LANDING PAGE (Puerto 3000)...
start "Landing-Page" cmd /k "cd /d C:\Dev\landing-page && echo 🌍 INICIANDO LANDING PAGE... && \"C:\Program Files\nodejs\npm.cmd\" run dev"

echo ⏳ Esperando 3 segundos...
timeout /t 3 /nobreak >nul

echo 🔧 INICIANDO BACKEND (Puerto 3002)...
start "Backend-API" cmd /k "cd /d C:\Dev\job-platform\backend && echo 🚀 SERVIDOR BACKEND... && \"C:\Program Files\nodejs\node.exe\" index.js"

echo ⏳ Esperando 3 segundos para que el backend se inicie...
timeout /t 3 /nobreak >nul

echo 🌐 INICIANDO FRONTEND (Puerto 3006)...
start "Frontend-NextJS" cmd /k "cd /d C:\Dev\job-platform\frontend && echo 🎯 INICIANDO FRONTEND... && \"C:\Program Files\nodejs\npm.cmd\" run dev"

echo.
echo ✅ SERVIDORES INICIADOS:
echo 🌍 Landing Page: http://localhost:3000
echo 🔧 Backend: http://localhost:3002
echo 🌐 Frontend: http://localhost:3006
echo.
echo 📋 URLs PRINCIPALES:
echo • Landing: http://localhost:3000/
echo • Dashboard: http://localhost:3006/
echo • Ofertas: http://localhost:3006/ofertas
echo • Conexiones: http://localhost:3006/conexiones
echo.
echo 🎉 ¡Listo para usar!
echo Presiona cualquier tecla para salir...
pause >nul

