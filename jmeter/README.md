# Pruebas con JMeter - EventFlow

## Ejecutar Pruebas con Docker

JMeter ya está integrado en Docker Compose. No necesitas descargar nada.

### 1. Levantar el sistema completo

```bash
docker-compose up -d
```

### 2. Ejecutar las pruebas

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
```

### 3. Ver resultados

```bash
# Abrir reporte HTML
open jmeter/results/report/index.html
```

## Escenarios de Prueba

### 1. Crear Usuarios (Carga)

- **Hilos:** 50 usuarios concurrentes
- **Ramp-up:** 10 segundos
- **Objetivo:** Probar la capacidad del servicio de usuarios bajo carga

### 2. Crear Eventos (Carga)

- **Hilos:** 20 usuarios concurrentes
- **Ramp-up:** 5 segundos
- **Objetivo:** Validar la creación de eventos bajo carga moderada

### 3. Consultar Eventos (Estrés - Lectura)

- **Hilos:** 100 usuarios concurrentes
- **Loops:** 10 iteraciones por usuario
- **Ramp-up:** 20 segundos
- **Objetivo:** Probar el rendimiento de lectura con Redis caché (consistencia eventual)

### 4. Crear Reservas - SAGA (Concurrencia)

- **Hilos:** 30 usuarios concurrentes
- **Ramp-up:** 5 segundos
- **Objetivo:** Probar el patrón SAGA bajo concurrencia y validar que no haya sobreventa

## Preparar Datos de Prueba

Antes de ejecutar las pruebas de reservas, necesitas IDs reales:

```bash
# 1. Crear usuarios y eventos de prueba
./test.sh

# 2. Extraer IDs y actualizar test-data.csv
# Reemplaza los IDs en jmeter/test-data.csv con IDs reales de tu base de datos
```

## Métricas a Observar

### Rendimiento

- **Throughput:** Transacciones por segundo
- **Latencia promedio:** Tiempo de respuesta promedio
- **Percentil 90/95/99:** Tiempos de respuesta para el 90%, 95% y 99% de las peticiones

### Consistencia

- **Tasa de error:** Debe ser < 1% en condiciones normales
- **Reservas exitosas vs fallidas:** Validar que no haya sobreventa
- **Compensaciones SAGA:** Verificar que las transacciones fallidas se reviertan correctamente

## Resultados Esperados

### Lectura de Eventos (con Redis)

- Latencia: < 50ms
- Throughput: > 500 req/s
- Tasa de error: < 0.1%

### Escritura de Reservas (SAGA)

- Latencia: 200-500ms (incluye múltiples servicios)
- Throughput: 50-100 req/s
- Tasa de error: < 5% (por validaciones de negocio)

### Consistencia de Inventario

- **Crítico:** El inventario nunca debe ser negativo
- Verificar en MongoDB después de las pruebas:

```bash
docker exec -it eventflow-mongodb mongosh eventflow_events --eval "db.events.find({}, {nombre: 1, aforo_total: 1, entradas_disponibles: 1})"
```
