const express = require("express")
const router = express.Router()
const Event = require("../models/Event")
const Joi = require("joi")

// Validación con Joi
const eventSchema = Joi.object({
  nombre: Joi.string().required(),
  descripcion: Joi.string().required(),
  fecha: Joi.date().required(),
  lugar: Joi.string().required(),
  aforo_total: Joi.number().min(1).required(),
  precio: Joi.number().min(0).required(),
  categoria: Joi.string().valid("Concierto", "Conferencia", "Deportivo", "Teatro", "Otro").optional(),
})

// POST /api/eventos - Crear nuevo evento
router.post("/", async (req, res) => {
  try {
    // Validar datos de entrada
    const { error, value } = eventSchema.validate(req.body)
    if (error) {
      return res.status(400).json({ error: error.details[0].message })
    }

    // Crear evento con entradas disponibles igual al aforo total
    const event = new Event({
      ...value,
      entradas_disponibles: value.aforo_total,
    })

    await event.save()

    // Inicializar inventario en Redis para control de concurrencia
    await req.redisClient.set(`event:${event._id}:inventory`, event.entradas_disponibles)

    // Invalidar caché de listado
    await req.redisClient.del("events:list")

    res.status(201).json({
      message: "Evento creado exitosamente",
      evento_id: event._id,
      nombre: event.nombre,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/eventos - Listar todos los eventos
router.get("/", async (req, res) => {
  try {
    // Intentar obtener de caché
    const cached = await req.redisClient.get("events:list")
    if (cached) {
      console.log("Cache hit for events list")
      return res.json(JSON.parse(cached))
    }

    // Si no está en caché, buscar en MongoDB
    const events = await Event.find().sort({ fecha: 1 })

    // Guardar en caché por 5 minutos (consistencia eventual)
    await req.redisClient.setEx("events:list", 300, JSON.stringify(events))

    res.json(events)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/eventos/:evento_id - Obtener evento (con caché Redis)
router.get("/:evento_id", async (req, res) => {
  try {
    const { evento_id } = req.params

    // Intentar obtener de caché
    const cached = await req.redisClient.get(`event:${evento_id}`)
    if (cached) {
      console.log("Cache hit for event:", evento_id)
      return res.json(JSON.parse(cached))
    }

    // Si no está en caché, buscar en MongoDB
    const event = await Event.findById(evento_id)

    if (!event) {
      return res.status(404).json({ error: "Evento no encontrado" })
    }

    // Obtener inventario actualizado de Redis
    const inventory = await req.redisClient.get(`event:${evento_id}:inventory`)
    if (inventory !== null) {
      event.entradas_disponibles = Number.parseInt(inventory)
    }

    // Guardar en caché por 2 minutos (consistencia eventual)
    await req.redisClient.setEx(`event:${evento_id}`, 120, JSON.stringify(event))

    res.json(event)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/eventos/:evento_id/inventario - Reducir inventario (uso interno)
router.put("/:evento_id/inventario", async (req, res) => {
  try {
    const { evento_id } = req.params
    const { cantidad } = req.body

    // Usar Redis para control atómico de inventario
    const inventoryKey = `event:${evento_id}:inventory`
    const currentInventory = await req.redisClient.get(inventoryKey)

    if (currentInventory === null) {
      // Inicializar desde MongoDB si no existe en Redis
      const event = await Event.findById(evento_id)
      if (!event) {
        return res.status(404).json({ error: "Evento no encontrado" })
      }
      await req.redisClient.set(inventoryKey, event.entradas_disponibles)
    }

    // Decrementar inventario de forma atómica
    const newInventory = await req.redisClient.decrBy(inventoryKey, cantidad)

    if (newInventory < 0) {
      // Revertir si no hay suficiente inventario
      await req.redisClient.incrBy(inventoryKey, cantidad)
      return res.status(409).json({ error: "No hay suficientes entradas disponibles" })
    }

    // Actualizar MongoDB de forma asíncrona (consistencia eventual)
    Event.findByIdAndUpdate(evento_id, {
      $inc: { entradas_disponibles: -cantidad },
    }).exec()

    // Invalidar caché
    await req.redisClient.del(`event:${evento_id}`)

    res.json({
      message: "Inventario actualizado",
      entradas_disponibles: newInventory,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PUT /api/eventos/:evento_id/inventario/revertir - Revertir inventario (compensación SAGA)
router.put("/:evento_id/inventario/revertir", async (req, res) => {
  try {
    const { evento_id } = req.params
    const { cantidad } = req.body

    // Incrementar inventario de forma atómica en Redis
    const inventoryKey = `event:${evento_id}:inventory`
    const newInventory = await req.redisClient.incrBy(inventoryKey, cantidad)

    // Actualizar MongoDB
    await Event.findByIdAndUpdate(evento_id, {
      $inc: { entradas_disponibles: cantidad },
    })

    // Invalidar caché
    await req.redisClient.del(`event:${evento_id}`)

    res.json({
      message: "Inventario revertido",
      entradas_disponibles: newInventory,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

module.exports = router
