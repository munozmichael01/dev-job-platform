#!/bin/bash
echo "🛑 DETENIENDO JOB PLATFORM"
echo ""

# Leer PIDs si existen
if [ -f .pids ]; then
    source .pids
    echo "🔧 Deteniendo Backend (PID: $BACKEND_PID)..."
    kill $BACKEND_PID 2>/dev/null || echo "   Backend ya estaba detenido"
    
    echo "🌐 Deteniendo Frontend (PID: $FRONTEND_PID)..."
    kill $FRONTEND_PID 2>/dev/null || echo "   Frontend ya estaba detenido"
    
    rm .pids
else
    echo "⚠️  No se encontró archivo .pids, intentando matar por puerto..."
    
    # Matar por puerto
    echo "🔧 Matando procesos en puerto 3002..."
    lsof -ti:3002 | xargs kill -9 2>/dev/null || echo "   Puerto 3002 libre"
    
    echo "🌐 Matando procesos en puerto 3006..."
    lsof -ti:3006 | xargs kill -9 2>/dev/null || echo "   Puerto 3006 libre"
fi

echo ""
echo "✅ Servidores detenidos"
echo "🧹 Limpiando logs..."
rm -f backend.log frontend.log

echo "🎉 ¡Listo!"
