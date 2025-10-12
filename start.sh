#!/bin/bash

# EventFlow - Script de inicio del sistema de microservicios
# Autor: Sistema EventFlow
# Descripción: Levanta todos los servicios con Docker Compose

set -e  # Detener en caso de error

echo "🚀 EventFlow - Iniciando sistema de microservicios..."
echo ""

# Verificar que Docker esté instalado
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker no está instalado"
    echo "Por favor instala Docker desde: https://docs.docker.com/get-docker/"
    exit 1
fi

# Verificar que Docker Compose esté instalado
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: Docker Compose no está instalado"
    echo "Por favor instala Docker Compose desde: https://docs.docker.com/compose/install/"
    exit 1
fi

# Verificar que Docker esté corriendo
if ! docker info &> /dev/null; then
    echo "❌ Error: Docker no está corriendo"
    echo "Por favor inicia Docker Desktop o el daemon de Docker"
    exit 1
fi

echo "✅ Docker está instalado y corriendo"
echo ""

# Limpiar contenedores anteriores si existen
echo "🧹 Limpiando contenedores anteriores..."
docker-compose down 2>/dev/null || true
echo ""

# Construir y levantar los servicios
echo "🔨 Construyendo imágenes Docker..."
docker-compose build

echo ""
echo "🚀 Levantando servicios..."
docker-compose up -d

echo ""
echo "⏳ Esperando que los servicios estén listos..."
sleep 10

# Verificar el estado de los servicios
echo ""
echo "📊 Estado de los servicios:"
docker-compose ps

echo ""
echo "✅ Sistema EventFlow iniciado correctamente!"
echo ""
echo "📡 Servicios disponibles:"
echo "   - Users Service:        http://localhost:3001"
echo "   - Events Service:       http://localhost:3002"
echo "   - Reservations Service: http://localhost:3003"
echo "   - MongoDB:              localhost:27017"
echo "   - Redis:                localhost:6379"
echo ""
echo "📝 Ver logs en tiempo real:"
echo "   docker-compose logs -f"
echo ""
echo "🛑 Detener el sistema:"
echo "   ./stop.sh"
echo ""
