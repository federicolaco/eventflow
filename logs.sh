#!/bin/bash

# EventFlow - Script para ver logs
# Descripción: Muestra los logs de los servicios

SERVICE=$1

if [ -z "$SERVICE" ]; then
    echo "📝 EventFlow - Mostrando logs de todos los servicios"
    echo "   Presiona Ctrl+C para salir"
    echo ""
    docker-compose logs -f
else
    echo "📝 EventFlow - Mostrando logs de: $SERVICE"
    echo "   Presiona Ctrl+C para salir"
    echo ""
    docker-compose logs -f "$SERVICE"
fi
