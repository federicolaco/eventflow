#!/bin/bash

# EventFlow - Script para detener el sistema
# Descripción: Detiene todos los servicios de forma ordenada

set -e

echo "🛑 EventFlow - Deteniendo sistema de microservicios..."
echo ""

# Detener los servicios
docker-compose down

echo ""
echo "✅ Sistema detenido correctamente"
echo ""
echo "💡 Para volver a iniciar el sistema:"
echo "   ./start.sh"
echo ""
