# EventFlow - Sistema de microservicios para gestión de eventos

## Decisiones de Diseño: Tecnologías y Estructura del Proyecto

### Arquitectura General

**Decisión:** Implementar una arquitectura basada en **microservicios**.

**Justificación:**  
La separación en microservicios permite escalar cada componente de forma independiente, aislar fallos y facilitar la evolución futura del sistema. Además, cada servicio puede utilizar la base de datos o tecnología que mejor se adapte a su naturaleza, cumpliendo con el principio de **bases de datos políglotas**.

---

### Lenguaje y Framework

**Decisión:** Utilizar **Python con FastAPI** para el desarrollo de los microservicios.

**Justificación:**

- FastAPI es un framework moderno, rápido y asincrónico, ideal para construir APIs RESTful con alto rendimiento.
- Su sintaxis es clara y declarativa, lo que reduce el tiempo de desarrollo.
- Proporciona documentación automática (Swagger UI) sin configuración adicional.
- Facilita la integración con bibliotecas de validación, autenticación y serialización de datos.

---

### Bases de Datos NoSQL

**Decisión:** Utilizar **MongoDB** y **Redis** como bases de datos principales.

**Justificación:**

#### MongoDB (para Usuarios y Eventos)

- Modelo orientado a documentos, flexible para almacenar estructuras JSON complejas.
- Escalable horizontalmente, lo que permite manejar grandes volúmenes de lectura y escritura.
- Ideal para datos que requieren consultas dinámicas y relaciones embebidas o referenciadas.

#### Redis (para Reservas y Pagos)

- Almacenamiento en memoria con acceso ultrarrápido.
- Soporta operaciones atómicas, lo que permite asegurar consistencia temporal durante transacciones críticas.
- Ideal para colas de transacciones y cacheo de datos de sesión.
- Aporta tolerancia a particiones y baja latencia, requisitos clave en operaciones financieras de corta duración.

---

### Despliegue y Entorno

**Decisión:** Utilizar **Docker y Docker Compose** para la orquestación del entorno.

**Justificación:**

- Docker garantiza que cada microservicio se ejecute en un entorno aislado y reproducible.
- Docker Compose simplifica la definición de dependencias entre servicios (FastAPI, MongoDB, Redis) y permite levantar todo el sistema con un solo comando.
- Facilita la portabilidad del proyecto entre equipos y entornos (desarrollo, pruebas, producción).

---

## Instalación

**Pre-condiciones**

- Docker en ejecución
- Comenzar parado en la base del proyecto

En la base del proyecto, ejecutar en la consola

`docker compose up -d`
