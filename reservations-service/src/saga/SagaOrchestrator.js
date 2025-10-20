const axios = require("axios")

/**
 * SAGA Orchestrator - Patrón de Orquestación
 * Coordina la transacción distribuida de reserva de entradas
 */
class SagaOrchestrator {
  constructor(reservation, redisClient) {
    this.reservation = reservation
    this.redisClient = redisClient
    this.usersServiceUrl = process.env.USERS_SERVICE_URL || "http://localhost:3001"
    this.eventsServiceUrl = process.env.EVENTS_SERVICE_URL || "http://localhost:3002"
  }

  /**
   * Ejecutar la transacción SAGA completa
   */
  async execute() {
    try {
      console.log(`[SAGA] Iniciando transacción para reserva ${this.reservation._id}`)

      // Paso 1: Validar usuario existe
      await this.validateUser()

      // Paso 2: Validar evento existe y tiene disponibilidad
      await this.validateEvent()

      // Paso 3: Reservar inventario (reducir entradas disponibles)
      await this.reserveInventory()

      // Paso 4: Procesar pago (simulado)
      await this.processPayment()

      // Paso 5: Actualizar historial de usuario
      await this.updateUserHistory()

      // Paso 6: Confirmar reserva
      await this.confirmReservation()

      console.log(`[SAGA] Transacción completada exitosamente para reserva ${this.reservation._id}`)
      return { success: true, reservation: this.reservation }
    } catch (error) {
      console.error(`[SAGA] Error en transacción: ${error.message}`)

      // Ejecutar compensación
      await this.compensate(error)

      return { success: false, error: error.message }
    }
  }

  /**
   * Paso 1: Validar que el usuario existe
   */
  async validateUser() {
    try {
      this.reservation.saga_estado = "validando"
      await this.reservation.save()

      const response = await axios.get(`${this.usersServiceUrl}/api/users/${this.reservation.usuario_id}`, {
        timeout: 5000,
      })

      this.reservation.saga_pasos_completados.push({
        paso: "validar_usuario",
        timestamp: new Date(),
        resultado: "exitoso",
      })

      console.log(`[SAGA] Usuario validado: ${this.reservation.usuario_id}`)
    } catch (error) {
      throw new Error(`Validación de usuario fallida: ${error.message}`)
    }
  }

  /**
   * Paso 2: Validar que el evento existe y tiene disponibilidad
   */
  async validateEvent() {
    try {
      const response = await axios.get(`${this.eventsServiceUrl}/api/eventos/${this.reservation.evento_id}`, {
        timeout: 5000,
      })

      const event = response.data

      // Verificar disponibilidad
      if (event.entradas_disponibles < this.reservation.cantidad) {
        throw new Error("No hay suficientes entradas disponibles")
      }

      // Verificar que el evento esté activo
      if (event.estado !== "activo") {
        throw new Error("El evento no está activo")
      }

      this.reservation.saga_pasos_completados.push({
        paso: "validar_evento",
        timestamp: new Date(),
        resultado: "exitoso",
      })

      console.log(`[SAGA] Evento validado: ${this.reservation.evento_id}`)
    } catch (error) {
      throw new Error(`Validación de evento fallida: ${error.message}`)
    }
  }

  /**
   * Paso 3: Reservar inventario (reducir entradas disponibles)
   */
  async reserveInventory() {
    try {
      this.reservation.saga_estado = "reservando"
      await this.reservation.save()

      const response = await axios.put(
        `${this.eventsServiceUrl}/api/eventos/${this.reservation.evento_id}/inventario`,
        { cantidad: this.reservation.cantidad },
        { timeout: 5000 },
      )

      this.reservation.saga_pasos_completados.push({
        paso: "reservar_inventario",
        timestamp: new Date(),
        resultado: "exitoso",
      })

      console.log(`[SAGA] Inventario reservado: ${this.reservation.cantidad} entradas`)
    } catch (error) {
      throw new Error(`Reserva de inventario fallida: ${error.message}`)
    }
  }

  /**
   * Paso 4: Procesar pago (simulado)
   */
  async processPayment() {
    try {
      this.reservation.saga_estado = "pagando"
      await this.reservation.save()

      // Simular procesamiento de pago
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // Simular fallo aleatorio (10% de probabilidad para testing)
      if (Math.random() < 0.1 && process.env.NODE_ENV === "development") {
        throw new Error("Pago rechazado por el procesador")
      }

      this.reservation.saga_pasos_completados.push({
        paso: "procesar_pago",
        timestamp: new Date(),
        resultado: "exitoso",
      })

      console.log(`[SAGA] Pago procesado: $${this.reservation.monto_total}`)
    } catch (error) {
      throw new Error(`Procesamiento de pago fallido: ${error.message}`)
    }
  }

  /**
   * Paso 5: Actualizar historial de compras del usuario
   */
  async updateUserHistory() {
    try {
      await axios.put(
        `${this.usersServiceUrl}/api/users/${this.reservation.usuario_id}/compras`,
        {
          evento_id: this.reservation.evento_id,
          reserva_id: this.reservation._id.toString(),
          monto: this.reservation.monto_total,
        },
        { timeout: 5000 },
      )

      this.reservation.saga_pasos_completados.push({
        paso: "actualizar_historial",
        timestamp: new Date(),
        resultado: "exitoso",
      })

      console.log(`[SAGA] Historial de usuario actualizado`)
    } catch (error) {
      // Este paso es menos crítico, podemos continuar
      console.warn(`[SAGA] Advertencia: No se pudo actualizar historial - ${error.message}`)
    }
  }

  /**
   * Paso 6: Confirmar reserva
   */
  async confirmReservation() {
    this.reservation.estado = "confirmada"
    this.reservation.saga_estado = "completada"
    await this.reservation.save()

    console.log(`[SAGA] Reserva confirmada: ${this.reservation._id}`)
  }

  /**
   * Compensación: Revertir cambios en caso de fallo
   */
  async compensate(error) {
    try {
      console.log(`[SAGA] Iniciando compensación para reserva ${this.reservation._id}`)
      this.reservation.saga_estado = "compensando"
      await this.reservation.save()

      const completedSteps = this.reservation.saga_pasos_completados.map((s) => s.paso)

      // Compensar en orden inverso

      // Si se reservó inventario, revertirlo
      if (completedSteps.includes("reservar_inventario")) {
        try {
          await axios.put(
            `${this.eventsServiceUrl}/api/eventos/${this.reservation.evento_id}/inventario/revertir`,
            { cantidad: this.reservation.cantidad },
            { timeout: 5000 },
          )
          console.log(`[SAGA] Compensación: Inventario revertido`)
        } catch (err) {
          console.error(`[SAGA] Error al revertir inventario: ${err.message}`)
        }
      }

      // Marcar reserva como fallida
      this.reservation.estado = "fallida"
      this.reservation.saga_estado = "fallida"
      await this.reservation.save()

      console.log(`[SAGA] Compensación completada para reserva ${this.reservation._id}`)
    } catch (compensationError) {
      console.error(`[SAGA] Error crítico en compensación: ${compensationError.message}`)
      // En un sistema real, esto debería alertar al equipo de operaciones
    }
  }
}

module.exports = SagaOrchestrator
