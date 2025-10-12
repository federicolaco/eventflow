#!/bin/bash

# Script para levantar solo el Users Service
# Útil para desarrollo independiente

echo "🚀 Iniciando Users Service..."

# Verificar Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker no está instalado"
    exit 1
fi

# Levantar solo MongoDB y Redis para users
docker-compose up -d mongodb-users redis

echo "⏳ Esperando a que las bases de datos estén listas..."
sleep 5

# Levantar Users Service
docker-compose up -d users-service

echo "✅ Users Service iniciado"
echo ""
echo "📍 Endpoints disponibles:"
echo "   - http://localhost:3001/api/users"
echo ""
echo "📊 Ver logs:"
echo "   docker-compose logs -f users-service"
echo ""
echo "🛑 Detener:"
echo "   docker-compose stop users-service mongodb-users"
