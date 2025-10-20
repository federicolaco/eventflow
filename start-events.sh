#!/bin/bash

# Script para levantar solo el Events Service
# Útil para desarrollo independiente

echo "🚀 Iniciando Events Service..."

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado"
    exit 1
fi

# Levantar solo MongoDB y Redis para events
docker-compose up -d mongodb-events redis

echo "⏳ Esperando a que las bases de datos estén listas..."
sleep 5

# Levantar Events Service
docker-compose up -d events-service

echo "✅ Events Service iniciado"
echo ""
echo "📍 Endpoints disponibles:"
echo "   - http://localhost:3002/api/events"
echo ""
echo "📊 Ver logs:"
echo "   docker-compose logs -f events-service"
echo ""
echo "🛑 Detener:"
echo "   docker-compose stop events-service mongodb-events"
