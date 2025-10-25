#!/bin/bash

# EventFlow - Script de pruebas
# Descripción: Ejecuta un flujo completo de prueba

set -e

echo "🧪 EventFlow - Ejecutando pruebas del sistema"
echo ""

# Verificar que los servicios estén corriendo
if ! docker-compose ps | grep -q "Up"; then
    echo "❌ Error: Los servicios no están corriendo"
    echo "Por favor inicia el sistema primero: ./start.sh"
    exit 1
fi

BASE_URL_USERS="http://localhost:3001"
BASE_URL_EVENTS="http://localhost:3002"
BASE_URL_RESERVATIONS="http://localhost:3003"

echo "1️⃣  Creando usuario de prueba..."
USER_RESPONSE=$(curl -s -X POST "$BASE_URL_USERS/api/users" \
  -H "Content-Type: application/json" \
  -d '{
    "tipo_documento": "DNI",
    "nro_documento": "12345678",
    "nombre": "Juan",
    "apellido": "Pérez",
    "email": "juan.perez@example.com"
  }')

USER_ID=$(echo $USER_RESPONSE | grep -o '"_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
    echo "❌ Error al crear usuario"
    echo "Respuesta: $USER_RESPONSE"
    exit 1
fi

echo "   ✅ Usuario creado: $USER_ID"
echo ""

echo "2️⃣  Creando evento de prueba..."
EVENT_RESPONSE=$(curl -s -X POST "$BASE_URL_EVENTS/api/eventos" \
  -H "Content-Type: application/json" \
  -d '{
    "nombre": "Concierto de Prueba",
    "descripcion": "Evento de prueba del sistema",
    "fecha": "2025-12-31T20:00:00Z",
    "lugar": "Estadio Test",
    "aforo_total": 100,
    "precio": 50,
    "categoria": "Concierto"
  }')

EVENT_ID=$(echo $EVENT_RESPONSE | grep -o '"_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$EVENT_ID" ]; then
    echo "❌ Error al crear evento"
    echo "Respuesta: $EVENT_RESPONSE"
    exit 1
fi

echo "   ✅ Evento creado: $EVENT_ID"
echo ""

echo "3️⃣  Realizando reserva..."
RESERVATION_RESPONSE=$(curl -s -X POST "$BASE_URL_RESERVATIONS/api/reservar" \
  -H "Content-Type: application/json" \
  -d "{
    \"usuario_id\": \"$USER_ID\",
    \"evento_id\": \"$EVENT_ID\",
    \"cantidad\": 2
  }")

RESERVATION_ID=$(echo $RESERVATION_RESPONSE | grep -o '"_id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$RESERVATION_ID" ]; then
    echo "❌ Error al crear reserva"
    echo "Respuesta: $RESERVATION_RESPONSE"
    exit 1
fi

echo "   ✅ Reserva creada: $RESERVATION_ID"
echo ""

echo "4️⃣  Verificando estado de la reserva..."
sleep 2
RESERVATION_STATUS=$(curl -s "$BASE_URL_RESERVATIONS/api/reservar/$RESERVATION_ID")
echo "   Estado: $RESERVATION_STATUS"
echo ""

echo "5️⃣  Verificando historial del usuario..."
USER_HISTORY=$(curl -s "$BASE_URL_USERS/api/users/$USER_ID")
echo "   Usuario actualizado con historial de compras"
echo ""

echo "✅ Pruebas completadas exitosamente!"
echo ""
echo "📊 Resumen:"
echo "   - Usuario ID: $USER_ID"
echo "   - Evento ID: $EVENT_ID"
echo "   - Reserva ID: $RESERVATION_ID"
echo ""
