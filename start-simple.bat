@echo off
echo 🚀 INICIANDO JOB PLATFORM - VERSION SIMPLE
echo.

echo 🌍 INICIANDO LANDING PAGE (Puerto 3000)...
start "Landing-Page" cmd /k "cd /d C:\Dev\landing-page && npm run dev"

echo ⏳ Esperando 5 segundos...
timeout /t 5 /nobreak >nul

echo 🔧 INICIANDO BACKEND (Puerto 3002)...
start "Backend-API" cmd /k "cd /d C:\Dev\job-platform\backend && node index.js"

echo ⏳ Esperando 5 segundos...
timeout /t 5 /nobreak >nul

echo 🌐 INICIANDO FRONTEND (Puerto 3006)...
start "Frontend-NextJS" cmd /k "cd /d C:\Dev\job-platform\frontend && npm run dev"

echo.
echo ✅ SERVIDORES INICIADOS:
echo 🌍 Landing Page: http://localhost:3000
echo 🔧 Backend: http://localhost:3002
echo 🌐 Frontend: http://localhost:3006
echo.
echo 🎉 ¡Listo para usar!
echo Presiona cualquier tecla para salir...
pause >nul

