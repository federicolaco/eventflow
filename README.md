# EventFlow - Sistema de Microservicios para Gestión de Eventos

Sistema de microservicios para la plataforma ficticia "EventFlow", que gestiona la venta de entradas y organización de eventos mediante una arquitectura distribuida con patrones avanzados.

## Comandos de Ejecución

### Iniciar el Sistema Completo

```bash
# Dar permisos a los scripts
chmod +x *.sh

# Iniciar todos los servicios (incluye JMeter)
./start.sh
```

**Servicios disponibles:**

- Users Service: http://localhost:3001
- Events Service: http://localhost:3002
- Reservations Service: http://localhost:3003
- JMeter: Integrado en Docker

### Otros Comandos

```bash
./stop.sh         # Detener todos los servicios
./status.sh       # Ver estado del sistema
./logs.sh         # Ver logs en tiempo real
./test.sh         # Ejecutar pruebas automáticas
./run-jmeter.sh   # Ejecutar pruebas de carga con JMeter
./clean.sh        # Limpiar datos y contenedores
```

## Estructura de Directorios

```
eventflow-microservices/
├── users-service/              # Microservicio de Usuarios
│   ├── src/
│   │   ├── models/User.js     # Modelo con seudonimización y encriptación
│   │   ├── routes/userRoutes.js
│   │   └── utils/             # Utilidades de privacidad
│   └── Dockerfile
│
├── events-service/             # Microservicio de Eventos
│   ├── src/
│   │   ├── models/Event.js
│   │   └── routes/eventRoutes.js
│   └── Dockerfile
│
├── reservations-service/       # Microservicio de Reservas y Pagos
│   ├── src/
│   │   ├── saga/SagaOrchestrator.js      # Patrón SAGA
│   │   ├── chain/ReservationHandler.js   # Chain of Responsibility
│   │   └── routes/reservationRoutes.js
│   └── Dockerfile
│
├── jmeter/                     # Pruebas de carga con JMeter
│   ├── EventFlow-Test-Plan.jmx
│   └── README.md
│
├── docker-compose.yml          # Configuración completa del sistema
└── README.md                   # Este archivo
```

## Justificación del Diseño

### 1. Decisiones de Consistencia (Teorema CAP)

#### Users Service y Events Service: AP (Disponibilidad + Tolerancia a Particiones)

**Justificación:** La consulta de usuarios y eventos es más frecuente que su modificación. Ver datos de hace 2-5 minutos es aceptable para mejorar la disponibilidad y reducir latencia.

**Implementación:**

- Caché Redis con TTL de 2-5 minutos
- Invalidación de caché en escrituras
- Lecturas pueden servirse desde caché aunque MongoDB esté temporalmente no disponible

#### Reservations Service: CP (Consistencia + Tolerancia a Particiones)

**Justificación:** La venta de entradas requiere consistencia estricta para evitar sobreventa. Es inaceptable vender más entradas que el aforo disponible.

**Implementación:**

- Sin caché para operaciones de reserva
- Operaciones atómicas en Redis para control de inventario
- SAGA con compensación para mantener consistencia entre servicios

### 2. Modelado de Datos NoSQL

#### MongoDB como Base de Datos Principal

**Justificación:**

- Flexibilidad de esquema para eventos con atributos variables
- Documentos embebidos reducen joins (historial de compras en usuarios)
- Escalabilidad horizontal mediante sharding
- Alto rendimiento en lecturas (caso de uso principal)

#### Patrón de Datos Embebido

**Decisión:** El historial de compras se embebe en el documento de usuario.

**Justificación:**

- Las compras siempre se consultan junto con el usuario
- Evita joins costosos entre colecciones
- Mejor rendimiento en lecturas frecuentes
- Trade-off aceptado: Duplicación de datos (evento_id, monto)

#### Redis como Caché y Control de Concurrencia

**Justificación:**

- 100x más rápido que MongoDB para lecturas
- Operaciones atómicas (INCR/DECR) para inventario sin race conditions
- TTL automático para expiración de caché
- Pub/Sub preparado para eventos en tiempo real (extensión futura)

### 3. Patrón SAGA con Orquestación

**Ubicación:** `reservations-service/src/saga/SagaOrchestrator.js`

**Justificación de Orquestación vs Coreografía:**

- Visibilidad centralizada del flujo completo de la transacción
- Debugging más sencillo (un solo lugar para rastrear errores)
- Compensación centralizada (lógica de rollback en un solo lugar)
- Menor complejidad que eventos distribuidos

**Flujo de Transacción:**

```
1. Validar Usuario → 2. Validar Evento → 3. Reservar Inventario →
4. Procesar Pago → 5. Actualizar Historial → 6. Confirmar Reserva
```

**Transacciones de Compensación:**

- Si falla después de reservar inventario: Revertir inventario
- Si falla el pago: Revertir inventario y marcar reserva como fallida
- Todas las compensaciones se ejecutan en orden inverso

### 4. Patrón Chain of Responsibility

**Ubicación:** `reservations-service/src/chain/ReservationHandler.js`

**Justificación:**

- Fail-fast: Detectar errores antes de iniciar transacciones distribuidas costosas
- Separación de responsabilidades: Validaciones separadas de la lógica de negocio
- Extensibilidad: Fácil agregar nuevas validaciones sin modificar SAGA
- Performance: Evita llamadas HTTP innecesarias si los datos son inválidos

**Cadena de Manejadores:**

1. ValidadorDeDatos: Verifica campos requeridos y tipos
2. ValidadorDeInventario: Verifica disponibilidad de entradas
3. CalculadorDePrecio: Calcula precio total según cantidad
4. ValidadorDeLimiteDeCompra: Verifica límite máximo por usuario
5. CreadorDeReserva: Crea documento de reserva en estado PENDING

## Diagrama de Arquitectura

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Users Service  │     │ Events Service  │     │ Reservations    │
│   (Port 3001)   │     │   (Port 3002)   │     │   Service       │
│                 │     │                 │     │   (Port 3003)   │
│  - MongoDB      │     │  - MongoDB      │     │  - MongoDB      │
│  - Redis Cache  │     │  - Redis Cache  │     │  - SAGA Orch.   │
│  - Privacidad   │     │  - Inventario   │     │  - Chain of R.  │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                       │
         └───────────────────────┴───────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │                         │
              ┌─────▼─────┐           ┌──────▼──────┐
              │  MongoDB  │           │    Redis    │
              │  (3 DBs)  │           │   (Cache)   │
              └───────────┘           └─────────────┘
```

## Diagrama de Flujo del Patrón SAGA

```
[Cliente] → POST /api/reservar
                    │
                    ▼
         ┌──────────────────────┐
         │  Chain of            │
         │  Responsibility      │ ← Validaciones previas
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  SAGA Orchestrator   │
         │  Inicia Transacción  │
         └──────────┬───────────┘
                    │
    ┌───────────────┴───────────────┐
    │                               │
    ▼                               ▼
┌────────────┐                 ┌────────────┐
│  Paso 1:   │    SUCCESS      │  Paso 2:   │
│  Validar   │ ──────────────> │  Validar   │
│  Usuario   │                 │  Evento    │
└────────────┘                 └──────┬─────┘
                                      │
                                      ▼
                               ┌────────────┐
                               │  Paso 3:   │
                               │  Reservar  │
                               │  Inventario│
                               └──────┬─────┘
                                      │
                    ┌─────────────────┴─────────────────┐
                    │                                   │
                    ▼ SUCCESS                           ▼ ERROR
             ┌────────────┐                      ┌────────────┐
             │  Paso 4:   │                      │ Compensar: │
             │  Procesar  │                      │ Revertir   │
             │  Pago      │                      │ Inventario │
             └──────┬─────┘                      └──────┬─────┘
                    │                                   │
                    ▼ SUCCESS                           ▼
             ┌────────────┐                      ┌────────────┐
             │  Paso 5:   │                      │  Marcar    │
             │  Actualizar│                      │  Reserva   │
             │  Historial │                      │  Fallida   │
             └──────┬─────┘                      └────────────┘
                    │
                    ▼
             ┌────────────┐
             │  Paso 6:   │
             │  Confirmar │
             │  Reserva   │
             └──────┬─────┘
                    │
                    ▼
            [Reserva Exitosa]
```

## Diagrama del Patrón Chain of Responsibility

```
[Request] → {usuario_id, evento_id, cantidad}
                    │
                    ▼
         ┌──────────────────────┐
         │  Handler 1:          │
         │  ValidadorDeDatos    │ ← Verifica campos requeridos
         └──────────┬───────────┘
                    │ ✓ Datos válidos
                    ▼
         ┌──────────────────────┐
         │  Handler 2:          │
         │  ValidadorDeInventario│ ← Verifica disponibilidad
         └──────────┬───────────┘
                    │ ✓ Hay stock
                    ▼
         ┌──────────────────────┐
         │  Handler 3:          │
         │  CalculadorDePrecio  │ ← Calcula precio total
         └──────────┬───────────┘
                    │ ✓ Precio calculado
                    ▼
         ┌──────────────────────┐
         │  Handler 4:          │
         │  ValidadorDeLimite   │ ← Verifica límite máximo
         │  DeCompra            │
         └──────────┬───────────┘
                    │ ✓ Dentro del límite
                    ▼
         ┌──────────────────────┐
         │  Handler 5:          │
         │  CreadorDeReserva    │ ← Crea reserva PENDING
         └──────────┬───────────┘
                    │ ✓ Reserva creada
                    ▼
         ┌──────────────────────┐
         │  Iniciar SAGA        │
         └──────────────────────┘
```

## Justificación del Requisito Adicional: Exportación de Datos Anonimizados

### Estrategia de Anonimización

**Endpoint:** `GET /api/users/exportar`

**Técnicas Implementadas:**

#### 1. Seudonimización (Almacenamiento)

**Técnica:** Hash SHA-256 unidireccional del número de documento

**Justificación:**

- Irreversibilidad: Imposible recuperar el documento original del hash
- Consistencia: El mismo documento siempre genera el mismo hash (útil para búsquedas)
- Seguridad: Protección incluso si la base de datos es comprometida

**Implementación:**

```javascript
// Pre-save hook en User.js
userSchema.pre("save", function (next) {
  if (this.isNew || this.isModified("nro_documento")) {
    this.nro_documento_hash = crypto
      .createHash("sha256")
      .update(this.nro_documento)
      .digest("hex");
  }
  next();
});
```

#### 2. Anonimización (Exportación)

**Técnica:** Generalización y supresión de datos

**Transformaciones aplicadas:**

| Campo Original        | Campo Anonimizado                      | Técnica                       |
| --------------------- | -------------------------------------- | ----------------------------- |
| `nombre` + `apellido` | `nombre_anonimizado: "Usuario_XXX"`    | Supresión + ID genérico       |
| `email`               | `dominio_email: "gmail.com"`           | Generalización (solo dominio) |
| `nro_documento`       | ❌ Eliminado                           | Supresión completa            |
| `tipo_documento`      | ✓ Mantenido                            | Dato no identificable         |
| `fecha_registro`      | ✓ Mantenido                            | Útil para análisis temporal   |
| `historial_compras`   | `total_compras: 5`, `monto_total: 750` | Agregación                    |

**Justificación:**

- Utilidad preservada: Los datos siguen siendo útiles para análisis estadístico
- Privacidad garantizada: Imposible identificar individuos específicos
- Cumplimiento GDPR: Apropiado para compartir con terceros o análisis público

**Casos de uso:**

- Análisis de comportamiento de compra agregado
- Estudios de mercado sin comprometer privacidad
- Reportes públicos de estadísticas de eventos

#### 3. Encriptación Opcional (AES-256)

**Activación:** Variable de entorno `ENABLE_ENCRYPTION=true`

**Justificación:**

- Reversibilidad controlada: Permite recuperar el dato original con la clave
- Protección en reposo: Datos encriptados en la base de datos
- Gestión de claves: Clave almacenada en variable de entorno (fuera de la DB)

**Cuándo usar:**

- Datos altamente sensibles (médicos, financieros)
- Requisitos regulatorios estrictos (HIPAA, PCI-DSS)
- Ambientes donde la DB puede ser accedida por personal no autorizado

### Comparación de Técnicas

| Técnica                    | Reversible       | Búsqueda        | Performance | Caso de Uso                 |
| -------------------------- | ---------------- | --------------- | ----------- | --------------------------- |
| **Hash (SHA-256)**         | ❌ No            | ✓ Sí (por hash) | ⚡ Rápido   | Almacenamiento seguro       |
| **Encriptación (AES-256)** | ✓ Sí (con clave) | ❌ No           | 🐌 Lento    | Datos que deben recuperarse |
| **Anonimización**          | ❌ No            | ❌ No           | ⚡ Rápido   | Exportación/análisis        |

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
  "descripcion": "Gran concierto de rock",
  "fecha": "2025-12-31T20:00:00Z",
  "lugar": "Estadio Nacional",
  "aforo_total": 5000,
  "precio": 50,
  "categoria": "Concierto"
}

# Obtener evento
GET /api/events/{evento_id}
```

### Reservations Service (http://localhost:3003)

```bash
# Crear reserva (inicia SAGA + Chain of Responsibility)
POST /api/reservar
{
  "usuario_id": "507f1f77bcf86cd799439011",
  "evento_id": "507f1f77bcf86cd799439012",
  "cantidad": 2
}

# Obtener estado de reserva
GET /api/reservar/{reserva_id}
```

## Pruebas con JMeter

JMeter está integrado en Docker Compose. No necesitas descargar nada.

### Ejecutar Pruebas de Carga

```bash
# Opción 1: Usar el script automatizado
chmod +x run-jmeter.sh
./run-jmeter.sh

# Opción 2: Ejecutar manualmente
docker exec -it eventflow-jmeter jmeter \
  -n \
  -t /jmeter/EventFlow-Test-Plan.jmx \
  -l /results/results.jtl \
  -e \
  -o /results/report

# Ver reporte HTML
open jmeter/results/report/index.html
```

### Escenarios de Prueba

1. **Crear Usuarios (Carga):** 50 usuarios concurrentes en 10 segundos
2. **Crear Eventos (Carga):** 20 usuarios concurrentes en 5 segundos
3. **Consultar Eventos (Estrés):** 100 usuarios × 10 iteraciones en 20 segundos
4. **Crear Reservas - SAGA (Concurrencia):** 30 usuarios concurrentes en 5 segundos

### Métricas Esperadas

- **Lectura de Eventos (con Redis):** Latencia < 50ms, Throughput > 500 req/s
- **Escritura de Reservas (SAGA):** Latencia 200-500ms, Throughput 50-100 req/s
- **Tasa de error:** < 1% en condiciones normales

Ver documentación completa en `jmeter/README.md`

## Tecnologías Utilizadas

- **Node.js** - Runtime de JavaScript
- **Express** - Framework web
- **MongoDB** - Base de datos NoSQL
- **Redis** - Caché y control de concurrencia
- **Mongoose** - ODM para MongoDB
- **Docker & Docker Compose** - Contenedorización
- **JMeter** - Pruebas de carga y rendimiento

## Concepto: Event Sourcing y CQRS

### Event Sourcing

**Concepto:** Almacenar eventos en lugar de estados. Cada cambio en el sistema se registra como un evento inmutable.

**Ejemplo para EventFlow:**
En lugar de actualizar el campo `entradas_disponibles` directamente:

```javascript
// Enfoque tradicional (actual)
{ evento_id: "123", entradas_disponibles: 95 }

// Event Sourcing
[
  { tipo: "EventoCreado", aforo_total: 100, timestamp: "..." },
  { tipo: "EntradasReservadas", cantidad: 3, timestamp: "..." },
  { tipo: "EntradasReservadas", cantidad: 2, timestamp: "..." }
]
// Estado actual = 100 - 3 - 2 = 95
```

**Beneficios:**

- Auditoría completa: Historial completo de cambios
- Debugging: Reproducir el estado en cualquier momento
- Análisis temporal: Entender cómo evolucionó el sistema

### CQRS (Command Query Responsibility Segregation)

**Concepto:** Separar las operaciones de lectura (queries) de las de escritura (commands).

**Aplicación a EventFlow:**

- **Escritura:** MongoDB con Event Sourcing para reservas
- **Lectura:** Vista materializada en Redis optimizada para consultas

**Cuándo sería beneficioso:**

- Alto volumen de lecturas vs escrituras (10:1 o más)
- Necesidad de auditoría completa de transacciones
- Análisis histórico de ventas y tendencias

**Diferencia con la solución actual:**

- Actual: MongoDB + Redis (caché simple)
- Con CQRS: MongoDB (eventos) + Redis (vistas materializadas sincronizadas)
