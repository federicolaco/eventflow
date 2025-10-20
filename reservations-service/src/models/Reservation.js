const mongoose = require("mongoose")

const reservationSchema = new mongoose.Schema(
  {
    usuario_id: {
      type: String,
      required: true,
    },
    evento_id: {
      type: String,
      required: true,
    },
    cantidad: {
      type: Number,
      required: true,
      min: 1,
    },
    monto_total: {
      type: Number,
      required: true,
    },
    estado: {
      type: String,
      enum: ["pendiente", "confirmada", "cancelada", "fallida"],
      default: "pendiente",
    },
    // Información de la transacción SAGA
    saga_estado: {
      type: String,
      enum: ["iniciada", "validando", "reservando", "pagando", "completada", "compensando", "fallida"],
      default: "iniciada",
    },
    saga_pasos_completados: [
      {
        paso: String,
        timestamp: Date,
        resultado: String,
      },
    ],
    fecha_reserva: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  },
)

// Índices para consultas
reservationSchema.index({ usuario_id: 1 })
reservationSchema.index({ evento_id: 1 })
reservationSchema.index({ estado: 1 })

module.exports = mongoose.model("Reservation", reservationSchema)
