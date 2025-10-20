#!/bin/bash

# EventFlow - Script de limpieza completa
# Descripción: Elimina contenedores, volúmenes y datos

set -e

echo "🧹 EventFlow - Limpieza completa del sistema"
echo ""
echo "⚠️  ADVERTENCIA: Esto eliminará todos los datos almacenados"
echo ""
read -p "¿Estás seguro? (s/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Ss]$ ]]; then
    echo "❌ Operación cancelada"
    exit 1
fi

echo ""
echo "🗑️  Eliminando contenedores y volúmenes..."

# Detener y eliminar contenedores
docker-compose down -v

# Eliminar imágenes construidas
echo ""
echo "🗑️  Eliminando imágenes Docker..."
docker-compose down --rmi local 2>/dev/null || true

echo ""
echo "✅ Limpieza completa finalizada"
echo ""
echo "💡 Para volver a iniciar el sistema:"
echo "   ./start.sh"
echo ""
