const express = require("express");
const router = express.Router();
const Reservation = require("../models/Reservation");
const SagaOrchestrator = require("../saga/SagaOrchestrator");
const {
  ValidadorDeDatos,
  ValidadorDeInventario,
  CalculadorDePrecio,
  ValidadorDeLimiteDeCompra,
  CreadorDeReserva,
} = require("../chain/ReservationHandler");

// POST /api/reservar - Iniciar proceso de reserva
router.post("/", async (req, res) => {
  try {
    console.log("\n=== INICIANDO PROCESO DE RESERVA ===");

    // Construir la cadena de responsabilidad
    const validadorDatos = new ValidadorDeDatos();
    const validadorInventario = new ValidadorDeInventario(
      req.redisClient,
      process.env.EVENTS_SERVICE_URL
    );
    const calculadorPrecio = new CalculadorDePrecio(
      process.env.EVENTS_SERVICE_URL
    );
    const validadorLimite = new ValidadorDeLimiteDeCompra(req.redisClient);
    const creadorReserva = new CreadorDeReserva(Reservation);

    // Encadenar los manejadores
    validadorDatos
      .setNext(validadorInventario)
      .setNext(calculadorPrecio)
      .setNext(validadorLimite)
      .setNext(creadorReserva);

    // Ejecutar la cadena de responsabilidad
    const request = {
      usuario_id: req.body.usuario_id,
      evento_id: req.body.evento_id,
      cantidad: req.body.cantidad,
    };

    const processedRequest = await validadorDatos.handle(request);

    console.log("\n=== CADENA DE RESPONSABILIDAD COMPLETADA ===");
    console.log("=== INICIANDO SAGA ORCHESTRATOR ===\n");

    // Iniciar la transacción SAGA
    const saga = new SagaOrchestrator(
      processedRequest.reservation,
      req.redisClient
    );

    const result = await saga.execute();

    if (result.success) {
      res.status(201).json({
        message: "Reserva completada exitosamente",
        reserva_id: result.reservation._id,
        estado: result.reservation.estado,
        monto_total: result.reservation.monto_total,
        cantidad: result.reservation.cantidad,
      });
    } else {
      res.status(400).json({
        error: "La reserva no pudo ser completada",
        detalle: result.error,
      });
    }
  } catch (error) {
    console.error("Error en proceso de reserva:", error.message);
    res.status(400).json({ error: error.message });
  }
});

// GET /api/reservar/:reserva_id - Obtener estado de reserva
router.get("/:reserva_id", async (req, res) => {
  try {
    const reservation = await Reservation.findById(req.params.reserva_id);

    if (!reservation) {
      return res.status(404).json({ error: "Reserva no encontrada" });
    }

    res.json(reservation);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
