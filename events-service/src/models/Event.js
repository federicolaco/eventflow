const mongoose = require("mongoose")

const eventSchema = new mongoose.Schema(
  {
    nombre: {
      type: String,
      required: true,
    },
    descripcion: {
      type: String,
      required: true,
    },
    fecha: {
      type: Date,
      required: true,
    },
    lugar: {
      type: String,
      required: true,
    },
    aforo_total: {
      type: Number,
      required: true,
      min: 1,
    },
    entradas_disponibles: {
      type: Number,
      required: true,
      min: 0,
    },
    precio: {
      type: Number,
      required: true,
      min: 0,
    },
    categoria: {
      type: String,
      enum: ["Concierto", "Conferencia", "Deportivo", "Teatro", "Otro"],
      default: "Otro",
    },
    estado: {
      type: String,
      enum: ["activo", "cancelado", "finalizado"],
      default: "activo",
    },
  },
  {
    timestamps: true,
  },
)

// Índices para optimizar consultas de lectura
eventSchema.index({ fecha: 1 })
eventSchema.index({ categoria: 1 })
eventSchema.index({ estado: 1 })

module.exports = mongoose.model("Event", eventSchema)
