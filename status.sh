#!/bin/bash

# EventFlow - Script de estado del sistema
# Descripción: Muestra el estado actual de todos los servicios

echo "📊 EventFlow - Estado del Sistema"
echo ""

# Verificar si Docker está corriendo
if ! docker info &> /dev/null; then
    echo "❌ Docker no está corriendo"
    exit 1
fi

# Mostrar estado de contenedores
echo "🐳 Contenedores Docker:"
docker-compose ps
echo ""

# Verificar conectividad de servicios
echo "🔍 Verificando conectividad de servicios..."
echo ""

check_service() {
    local name=$1
    local url=$2
    
    if curl -s -f "$url" > /dev/null 2>&1; then
        echo "   ✅ $name está respondiendo"
    else
        echo "   ❌ $name no está respondiendo"
    fi
}

check_service "Users Service      " "http://localhost:3001/health"
check_service "Events Service     " "http://localhost:3002/health"
check_service "Reservations Service" "http://localhost:3003/health"

echo ""
echo "💾 Uso de recursos:"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
echo ""
