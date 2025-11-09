# EventFlow - Sistema de Microservicios para Gestión de Eventos

**Tarea 2 - 2025:** Diseño de un Sistema de Microservicios

---

## Comandos de Ejecución

```bash
# Iniciar el sistema completo
docker-compose up -d

# Ejecutar pruebas con JMeter (Linux/Mac)
./run-jmeter.sh

# Ejecutar pruebas con JMeter (Windows)
run-jmeter.bat

# Ver reporte de JMeter
open jmeter/results/report/index.html  # Mac/Linux
start jmeter/results/report/index.html # Windows

# Detener el sistema
docker-compose down
```

**Servicios:**

- Users Service: http://localhost:3001
- Events Service: http://localhost:3002
- Reservations Service: http://localhost:3003

---

## 1. Justificación del Diseño

### Requerimientos de Consistencia y Lectura/Escritura

**Users Service y Events Service: AP (Disponibilidad + Tolerancia a Particiones)**

Lectura con consistencia eventual, priorizando disponibilidad y velocidad mediante caché Redis con TTL de 2-5 minutos. La consulta de usuarios y eventos es más frecuente que su modificación (ratio 100:1). Ver datos desactualizados de hace 2-5 minutos es aceptable para la experiencia del usuario, permitiendo alta disponibilidad y reduciendo latencia de ~50ms a <5ms.

**Implementación:** Caché Redis con invalidación inmediata en escrituras. Escrituras van a MongoDB primero, luego invalidan caché.

**Reservations Service: CP (Consistencia + Tolerancia a Particiones)**

Escritura con alta consistencia, priorizando corrección sobre velocidad. La venta de entradas requiere consistencia estricta para evitar sobreventa. Sin caché para operaciones de reserva, operaciones atómicas en Redis (`DECR`), y patrón SAGA con compensación para mantener consistencia entre servicios.

**Implementación:** Control de inventario atómico en Redis, SAGA para transacciones distribuidas.

---

### Modelado de Datos NoSQL

**MongoDB** como base de datos principal por su flexibilidad de esquema (eventos con atributos variables) y alto rendimiento en lecturas.

**Bases de datos:**

- `eventflow_users` - Usuarios con historial embebido
- `eventflow_events` - Eventos con categorías flexibles
- `eventflow_reservations` - Reservas con referencias

**Patrón de datos embebido** para historial de compras en usuarios:

```javascript
{
  _id: ObjectId("..."),
  nombre: "Juan",
  historial_compras: [  // Embebido
    {
      evento_id: ObjectId("..."),
      evento_nombre: "Concierto Rock",
      cantidad: 2,
      monto_total: 100
    }
  ]
}
```

**Justificación:** Las compras siempre se consultan junto con el usuario. Evita joins costosos y mejora rendimiento en lecturas. Trade-off aceptado: duplicación de datos (`evento_nombre`).

**Redis** para caché (100x más rápido que MongoDB) y operaciones atómicas (`INCR`, `DECR`) para inventario sin race conditions.

---

### Patrón SAGA con Orquestación

**Decisión:** Orquestación centralizada en Reservations Service.

**Justificación:** Visibilidad centralizada del flujo completo, debugging sencillo con logs centralizados, compensación simple en un solo lugar, menor complejidad vs coreografía.

**Pasos de transacción:**

1. Validar Usuario (Users Service)
2. Validar Evento (Events Service)
3. Reservar Inventario (Redis `DECR` atómico)
4. Procesar Pago (simulado)
5. Actualizar Historial Usuario
6. Confirmar Reserva (estado CONFIRMED)

**Compensaciones:** Si falla paso 3+, revertir inventario con Redis `INCR` y marcar reserva como FAILED. Idempotente.

**Ubicación:** `reservations-service/src/saga/SagaOrchestrator.js`

---

### Patrón Chain of Responsibility

**Justificación:** Validaciones secuenciales antes de iniciar SAGA. Fail-fast para detectar errores antes de transacciones distribuidas costosas.

**Cadena de manejadores:**

1. **ValidadorDeDatos** - Verifica campos requeridos y tipos
2. **ValidadorDeInventario** - Consulta Redis, verifica disponibilidad
3. **CalculadorDePrecio** - Calcula `monto_total = precio × cantidad`
4. **ValidadorDeLimiteDeCompra** - Verifica límite máximo (10 entradas)
5. **CreadorDeReserva** - Crea documento en estado PENDING

**Beneficio:** Cada manejador valida un aspecto específico. Si falta el campo `cantidad`, se rechaza antes de llamar a Users Service, Events Service y Redis.

**Ubicación:** `reservations-service/src/chain/ReservationHandler.js`

---

### Event Sourcing y CQRS (Concepto)

**Event Sourcing:** Almacenar eventos inmutables en lugar de estados. Cada cambio se registra como evento.

**CQRS:** Separar operaciones de lectura (queries) de escritura (commands).

**Aplicación a EventFlow:** MongoDB con eventos + Redis con vistas materializadas sincronizadas.

**Cuándo sería beneficioso:** Alto volumen de lecturas (>100:1), auditoría completa de transacciones, análisis histórico de ventas, requisitos regulatorios estrictos.

**No implementado:** La solución actual (caché simple) es suficiente. Event Sourcing + CQRS agregaría complejidad sin beneficios proporcionales para este caso de uso.

---

### Patrones de Privacidad de Datos

**Seudonimización:** Hash SHA-256 unidireccional del número de documento en `User.js`. Irreversible, consistente (mismo documento = mismo hash), protección si la base de datos es comprometida.

```javascript
this.nro_documento_hash = crypto
  .createHash("sha256")
  .update(this.nro_documento)
  .digest("hex");
```

**Encriptación AES-256:** Activable con `ENABLE_ENCRYPTION=true`. Reversible con clave, protección en reposo para emails y datos personales. Trade-off: +10-20ms de latencia.

---

### Exportación de Datos Anonimizados

**Endpoint:** `GET /api/users/exportar`

**Estrategia de anonimización:**

| Campo Original        | Campo Anonimizado                              | Técnica                 |
| --------------------- | ---------------------------------------------- | ----------------------- |
| `nombre` + `apellido` | `nombre_anonimizado: "Usuario_XXX"`            | Supresión + ID genérico |
| `email`               | `dominio_email: "gmail.com"`                   | Generalización          |
| `nro_documento`       | Eliminado                                      | Supresión               |
| `historial_compras`   | `total_compras: 5`, `monto_total_gastado: 750` | Agregación              |

**Justificación:** Utilidad preservada para análisis estadístico, privacidad garantizada (imposible identificar individuos), irreversibilidad total.

---

### Tecnologías de Despliegue

**Docker y Docker Compose:** Portabilidad (funciona en cualquier máquina), aislamiento (cada servicio en su contenedor), reproducibilidad (mismo entorno en desarrollo y producción).

**Estructura:**

- MongoDB (base de datos NoSQL)
- Redis (caché y control de concurrencia)
- users-service (Node.js + Express)
- events-service (Node.js + Express)
- reservations-service (Node.js + Express)
- jmeter (pruebas de carga)

Red Docker compartida para comunicación entre servicios por nombres (ej: `http://users-service:3001`).

---

### Pruebas con JMeter

JMeter integrado en docker-compose.yml, no requiere instalación manual.

**Escenarios:**

1. Carga en escritura de usuarios (50 usuarios concurrentes)
2. Carga en escritura de eventos (20 eventos concurrentes)
3. Estrés en lecturas con Redis (100 usuarios × 10 lecturas)
4. Concurrencia en SAGA (30 reservas simultáneas)

**Métricas validadas:** Throughput (transacciones/segundo), latencia (p50, p90, p95, p99), tasa de error (<1%), consistencia de inventario (sin sobreventa).

---

### Encriptación de Datos

AES-256-CBC para emails y datos personales en Users Service. Activable con `ENABLE_ENCRYPTION=true` y `ENCRYPTION_KEY`. Protección en reposo. Trade-off: ~10-20ms adicionales en operaciones.

---

## 2. Diagrama de Arquitectura

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENTES / API                              │
└───────────────────┬─────────────────┬──────────────────┬────────────┘
                    │                 │                  │
                    ▼                 ▼                  ▼
         ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
         │  Users Service   │ │ Events Service   │ │  Reservations    │
         │   (Port 3001)    │ │   (Port 3002)    │ │    Service       │
         │                  │ │                  │ │   (Port 3003)    │
         │  • MongoDB       │ │  • MongoDB       │ │  • MongoDB       │
         │  • Redis Cache   │ │  • Redis Cache   │ │  • SAGA Orch.    │
         │  • Privacidad    │ │  • Inventario    │ │  • Chain of R.   │
         │  • Encriptación  │ │  • TTL 5min      │ │  • Sin Caché     │
         │  • Anonimización │ │                  │ │                  │
         └────────┬─────────┘ └────────┬─────────┘ └────────┬─────────┘
                  │                    │                    │
                  └────────────────────┴────────────────────┘
                                       │
                      ┌────────────────┴────────────────┐
                      │                                 │
                ┌─────▼─────────────┐         ┌────────▼──────────┐
                │     MongoDB       │         │      Redis        │
                │  (3 Bases de      │         │  (Caché +         │
                │   Datos)          │         │   Inventario)     │
                │                   │         │                   │
                │ • eventflow_users │         │ • TTL automático  │
                │ • eventflow_events│         │ • Ops atómicas    │
                │ • eventflow_      │         │   (INCR/DECR)     │
                │   reservations    │         │                   │
                └───────────────────┘         └───────────────────┘
```

---

## 3. Diagrama de Flujo del Patrón SAGA

```
[Cliente] → POST /api/reservar
            { usuario_id, evento_id, cantidad }
                        │
                        ▼
             ┌──────────────────────────┐
             │  Chain of Responsibility │
             │  1. ValidadorDeDatos     │
             │  2. ValidadorInventario  │
             │  3. CalculadorPrecio     │
             │  4. ValidadorLimite      │
             │  5. CreadorReserva       │
             └────────────┬─────────────┘
                          │
                          ▼
             ┌──────────────────────────┐
             │   SAGA Orchestrator      │
             └────────────┬─────────────┘
                          │
          ┌───────────────┴───────────────┐
          │                               │
          ▼                               ▼
  ┌──────────────┐              ┌──────────────┐
  │   Paso 1:    │              │   Paso 2:    │
  │   Validar    │  ─────────>  │   Validar    │
  │   Usuario    │   SUCCESS    │   Evento     │
  └──────────────┘              └──────┬───────┘
                                       │
                                       ▼
                                ┌──────────────┐
                                │   Paso 3:    │
                                │   Reservar   │
                                │   Inventario │
                                │ (Redis DECR) │
                                └──────┬───────┘
                                       │
                   ┌───────────────────┴───────────────────┐
                   │ SUCCESS                               │ ERROR
                   ▼                                       ▼
            ┌──────────────┐                        ┌──────────────┐
            │   Paso 4:    │                        │  Compensar:  │
            │   Procesar   │                        │  Revertir    │
            │   Pago       │                        │  Inventario  │
            └──────┬───────┘                        │ (Redis INCR) │
                   │                                └──────────────┘
                   ▼
            ┌──────────────┐
            │   Paso 5:    │
            │   Actualizar │
            │   Historial  │
            └──────┬───────┘
                   │
                   ▼
            ┌──────────────┐
            │   Paso 6:    │
            │   Confirmar  │
            │   Reserva    │
            │ (CONFIRMED)  │
            └──────────────┘
```

**Compensaciones:** Fallo en Paso 3+ revierte inventario con Redis `INCR` + marca reserva como FAILED. Idempotente.

---

## 4. Diagrama del Patrón Chain of Responsibility

```
[Request] → { usuario_id, evento_id, cantidad }
                        │
                        ▼
             ┌──────────────────────────┐
             │      Handler 1:          │
             │   ValidadorDeDatos       │
             │ • Campos requeridos      │
             │ • Tipos de datos         │
             └────────────┬─────────────┘
                          │ ✓
                          ▼
             ┌──────────────────────────┐
             │      Handler 2:          │
             │  ValidadorDeInventario   │
             │ • Consulta Redis         │
             │ • cantidad <= disponible │
             └────────────┬─────────────┘
                          │ ✓
                          ▼
             ┌──────────────────────────┐
             │      Handler 3:          │
             │   CalculadorDePrecio     │
             │ • monto = precio × cant  │
             └────────────┬─────────────┘
                          │ ✓
                          ▼
             ┌──────────────────────────┐
             │      Handler 4:          │
             │   ValidadorDeLimite      │
             │ • cantidad <= 10         │
             └────────────┬─────────────┘
                          │ ✓
                          ▼
             ┌──────────────────────────┐
             │      Handler 5:          │
             │   CreadorDeReserva       │
             │ • Estado: PENDING        │
             └────────────┬─────────────┘
                          │ ✓
                          ▼
             ┌──────────────────────────┐
             │    Iniciar SAGA          │
             └──────────────────────────┘
```

**Ventaja:** Fail-fast rechaza solicitudes inválidas antes de transacciones costosas. Extensible sin modificar código existente.

---

## 5. Justificación del Requisito Adicional

**Exportación de Datos Anonimizados** (endpoint `GET /api/users/exportar`)

**Estrategia:** Supresión (eliminar `nro_documento`), generalización (`email` → `dominio_email`), agregación (`historial_compras` → `total_compras` y `monto_total_gastado`).

**Justificación:** Preserva utilidad para análisis estadístico (comportamiento de compra agregado, estudios de mercado) mientras garantiza privacidad absoluta. Irreversible: imposible recuperar datos originales.

---

## API Endpoints

### Users Service (http://localhost:3001)

```bash
# Crear usuario
POST /api/users
{
  "tipo_documento": "DNI",
  "nro_documento": "12345678",
  "nombre": "Juan",
  "apellido": "Pérez",
  "email": "juan@example.com"
}

# Obtener usuario
GET /api/users/{usuario_id}

# Exportar datos anonimizados
GET /api/users/exportar
```

### Events Service (http://localhost:3002)

```bash
# Crear evento
POST /api/events
{
  "nombre": "Concierto Rock 2025",
  "fecha": "2025-12-31T20:00:00Z",
  "aforo_total": 5000,
  "precio": 50
}

# Obtener evento (con caché Redis)
GET /api/events/{evento_id}
```

### Reservations Service (http://localhost:3003)

```bash
# Crear reserva (inicia SAGA + Chain)
POST /api/reservar
{
  "usuario_id": "507f...",
  "evento_id": "507f...",
  "cantidad": 2
}

# Obtener reserva
GET /api/reservar/{reserva_id}
```

---

## Pruebas con JMeter

```bash
# 1. Levantar sistema
docker-compose up -d

# 2. Ejecutar pruebas
./run-jmeter.sh      # Linux/Mac
run-jmeter.bat       # Windows

# 3. Ver reporte HTML
open jmeter/results/report/index.html  # Mac/Linux
start jmeter/results/report/index.html # Windows
```

**Escenarios:** Carga de usuarios (50 usuarios), carga de eventos (20 eventos), estrés en lecturas (100×10 loops), concurrencia SAGA (30 reservas).

**Métricas esperadas:**

- Lectura de eventos (Redis): <50ms, >500 req/s
- Escritura de usuarios: 100-200ms
- Reservas SAGA: 200-500ms

**Validar consistencia:**

```bash
docker exec -it eventflow-mongodb mongosh eventflow_events \
  --eval "db.events.find({}, {entradas_disponibles: 1})"
```

Verificar: `entradas_disponibles` nunca negativo y `<= aforo_total`.

---

## Tecnologías Utilizadas

| Tecnología | Versión | Propósito            |
| ---------- | ------- | -------------------- |
| Node.js    | 20 LTS  | Runtime de servicios |
| Express    | 4.18    | Framework web        |
| MongoDB    | 7.0     | Base de datos NoSQL  |
| Redis      | 7.2     | Caché y concurrencia |
| Docker     | Latest  | Contenedorización    |
| JMeter     | 5.6     | Pruebas de carga     |

---

## Variables de Entorno

**Configuración en docker-compose.yml:**

```yaml
# Users Service
NODE_ENV: development
ENABLE_ENCRYPTION: true  # Encriptación AES-256
ENCRYPTION_KEY: my-secret-encryption-key-change-in-production

# Events Service
NODE_ENV: development

# Reservations Service
NODE_ENV: development
```

Para producción, cambiar `NODE_ENV: production` y usar claves seguras.

---
