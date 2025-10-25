#!/bin/bash

# Script para levantar solo el Reservations Service
# Útil para desarrollo independiente

echo "🚀 Iniciando Reservations Service..."

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado"
    exit 1
fi

# Levantar MongoDB y Redis para reservations
docker-compose up -d mongodb-reservations redis

echo "⏳ Esperando a que las bases de datos estén listas..."
sleep 5

# Levantar Reservations Service
docker-compose up -d reservations-service

echo "✅ Reservations Service iniciado"
echo ""
echo "📍 Endpoints disponibles:"
echo "   - http://localhost:3003/api/reservar"
echo ""
echo "📊 Ver logs:"
echo "   docker-compose logs -f reservations-service"
echo ""
echo "🛑 Detener:"
echo "   docker-compose stop reservations-service mongodb-reservations"
echo ""
echo "⚠️  NOTA: Para probar el flujo completo de SAGA,"
echo "   necesitas levantar también users-service y events-service"
