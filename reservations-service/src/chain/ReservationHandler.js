/**
 * Patrón Chain of Responsibility
 * Cadena de manejadores para validar y procesar solicitudes de reserva
 */

class Handler {
  constructor() {
    this.nextHandler = null
  }

  setNext(handler) {
    this.nextHandler = handler
    return handler
  }

  async handle(request) {
    if (this.nextHandler) {
      return await this.nextHandler.handle(request)
    }
    return request
  }
}

/**
 * Manejador 1: Validar datos de entrada
 */
class ValidadorDeDatos extends Handler {
  async handle(request) {
    console.log("[Chain] Validando datos de entrada...")

    const { usuario_id, evento_id, cantidad } = request

    if (!usuario_id || !evento_id || !cantidad) {
      throw new Error("Datos incompletos: se requiere usuario_id, evento_id y cantidad")
    }

    if (cantidad < 1 || cantidad > 10) {
      throw new Error("La cantidad debe estar entre 1 y 10 entradas")
    }

    console.log("[Chain] Datos validados correctamente")
    return super.handle(request)
  }
}

/**
 * Manejador 2: Validar inventario disponible
 */
class ValidadorDeInventario extends Handler {
  constructor(redisClient, eventsServiceUrl) {
    super()
    this.redisClient = redisClient
    this.eventsServiceUrl = eventsServiceUrl
  }

  async handle(request) {
    console.log("[Chain] Validando inventario disponible...")

    const { evento_id, cantidad } = request

    // Verificar inventario en Redis
    const inventoryKey = `event:${evento_id}:inventory`
    const inventory = await this.redisClient.get(inventoryKey)

    if (inventory === null) {
      throw new Error("No se pudo verificar el inventario del evento")
    }

    const availableTickets = Number.parseInt(inventory)

    if (availableTickets < cantidad) {
      throw new Error(`Solo hay ${availableTickets} entradas disponibles`)
    }

    console.log("[Chain] Inventario suficiente")
    return super.handle(request)
  }
}

/**
 * Manejador 3: Calcular precio total
 */
class CalculadorDePrecio extends Handler {
  constructor(eventsServiceUrl) {
    super()
    this.eventsServiceUrl = eventsServiceUrl
  }

  async handle(request) {
    console.log("[Chain] Calculando precio total...")

    const axios = require("axios")
    const { evento_id, cantidad } = request

    try {
      const response = await axios.get(`${this.eventsServiceUrl}/api/eventos/${evento_id}`, { timeout: 5000 })

      const event = response.data
      request.precio_unitario = event.precio
      request.monto_total = event.precio * cantidad

      console.log(`[Chain] Precio calculado: $${request.monto_total}`)
      return super.handle(request)
    } catch (error) {
      throw new Error(`Error al calcular precio: ${error.message}`)
    }
  }
}

/**
 * Manejador 4: Verificar límite de compra por usuario
 */
class ValidadorDeLimiteDeCompra extends Handler {
  constructor(redisClient) {
    super()
    this.redisClient = redisClient
  }

  async handle(request) {
    console.log("[Chain] Verificando límite de compra...")

    const { usuario_id, evento_id, cantidad } = request

    // Verificar cuántas entradas ha comprado este usuario para este evento
    const purchaseKey = `user:${usuario_id}:event:${evento_id}:purchases`
    const currentPurchases = await this.redisClient.get(purchaseKey)

    const totalPurchases = currentPurchases ? Number.parseInt(currentPurchases) : 0
    const maxPerUser = 10

    if (totalPurchases + cantidad > maxPerUser) {
      throw new Error(`Límite de compra excedido. Máximo ${maxPerUser} entradas por usuario`)
    }

    // Actualizar contador (temporal, 24 horas)
    await this.redisClient.setEx(purchaseKey, 86400, (totalPurchases + cantidad).toString())

    console.log("[Chain] Límite de compra verificado")
    return super.handle(request)
  }
}

/**
 * Manejador 5: Crear registro de reserva
 */
class CreadorDeReserva extends Handler {
  constructor(ReservationModel) {
    super()
    this.ReservationModel = ReservationModel
  }

  async handle(request) {
    console.log("[Chain] Creando registro de reserva...")

    const reservation = new this.ReservationModel({
      usuario_id: request.usuario_id,
      evento_id: request.evento_id,
      cantidad: request.cantidad,
      monto_total: request.monto_total,
      estado: "pendiente",
      saga_estado: "iniciada",
    })

    await reservation.save()
    request.reservation = reservation

    console.log(`[Chain] Reserva creada: ${reservation._id}`)
    return super.handle(request)
  }
}

module.exports = {
  ValidadorDeDatos,
  ValidadorDeInventario,
  CalculadorDePrecio,
  ValidadorDeLimiteDeCompra,
  CreadorDeReserva,
}
