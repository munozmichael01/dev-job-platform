#!/bin/bash
echo "🚀 INICIANDO JOB PLATFORM - ARQUITECTURA SARGABLE"
echo ""

# Verificar puertos
echo "⏳ Verificando puertos..."
if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Puerto 3002 ocupado. Mata el proceso antes de continuar."
    echo "   Use: lsof -ti:3002 | xargs kill -9"
    exit 1
fi

if lsof -Pi :3006 -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "❌ Puerto 3006 ocupado. Mata el proceso antes de continuar."
    echo "   Use: lsof -ti:3006 | xargs kill -9"
    exit 1
fi

echo "✅ Puertos libres. Continuando..."
echo ""

# Iniciar backend en background
echo "🔧 INICIANDO BACKEND (Puerto 3002)..."
cd backend
nohup node index_sargable.js > ../backend.log 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
cd ..

# Esperar un momento
echo "⏳ Esperando 3 segundos para que el backend se inicie..."
sleep 3

# Iniciar frontend en background
echo "🌐 INICIANDO FRONTEND (Puerto 3006)..."
cd frontend
nohup npm run dev > ../frontend.log 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
cd ..

echo ""
echo "✅ SERVIDORES INICIADOS:"
echo "🔧 Backend: http://localhost:3002 (PID: $BACKEND_PID)"
echo "🌐 Frontend: http://localhost:3006 (PID: $FRONTEND_PID)"
echo ""
echo "📋 URLs PRINCIPALES:"
echo "• Dashboard: http://localhost:3006/"
echo "• Ofertas: http://localhost:3006/ofertas"
echo "• Conexiones: http://localhost:3006/conexiones"
echo ""
echo "📝 Logs:"
echo "• Backend: tail -f backend.log"
echo "• Frontend: tail -f frontend.log"
echo ""
echo "🛑 Para detener:"
echo "kill $BACKEND_PID $FRONTEND_PID"
echo ""
echo "🎉 ¡Listo para usar!"

# Guardar PIDs para stop script
echo "BACKEND_PID=$BACKEND_PID" > .pids
echo "FRONTEND_PID=$FRONTEND_PID" >> .pids
