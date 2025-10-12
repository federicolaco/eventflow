const express = require("express");
const router = express.Router();
const User = require("../models/User");
const Joi = require("joi");

// Validación con Joi
const userSchema = Joi.object({
  tipo_documento: Joi.string()
    .valid("DNI", "Pasaporte", "Cedula", "Otro")
    .required(),
  nro_documento: Joi.string().required(),
  nombre: Joi.string().required(),
  apellido: Joi.string().required(),
  email: Joi.string().email().required(),
});

// POST /api/users - Crear nuevo usuario
router.post("/", async (req, res) => {
  try {
    // Validar datos de entrada
    const { error, value } = userSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    // Crear usuario
    const user = new User(value);

    // Aplicar seudonimización (opcional)
    if (process.env.ENABLE_ENCRYPTION === "true") {
      user.encryptSensitiveData();
    }

    await user.save();

    // Invalidar caché
    await req.redisClient.del(`user:${user._id}`);

    res.status(201).json({
      message: "Usuario creado exitosamente",
      usuario_id: user._id,
      email: user.email,
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Usuario ya existe" });
    }
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users - Listar todos los usuarios
router.get("/", async (req, res) => {
  try {
    const users = await User.find().select(
      "-email_encrypted -nro_documento_hash"
    );

    res.json({
      total: users.length,
      usuarios: users,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/exportar - Exportar datos anonimizados (OPCIONAL)
router.get("/exportar", async (req, res) => {
  try {
    const users = await User.find().select(
      "-email_encrypted -nro_documento_hash"
    );

    // Anonimizar datos irreversiblemente
    const anonymizedUsers = users.map((user) => ({
      usuario_id_anonimo: user._id.toString().substring(0, 8) + "XXXX",
      tipo_documento: user.tipo_documento,
      // Anonimizar documento (solo primeros 2 caracteres)
      nro_documento_anonimo: user.nro_documento.substring(0, 2) + "XXXXX",
      // Anonimizar nombre y apellido
      nombre_anonimo: user.nombre.charAt(0) + "***",
      apellido_anonimo: user.apellido.charAt(0) + "***",
      // Anonimizar email (mantener dominio)
      email_anonimo: "usuario***@" + user.email.split("@")[1],
      cantidad_compras: user.historial_compras.length,
      fecha_registro: user.fecha_registro,
      // Mantener información de análisis
      historial_compras_anonimo: user.historial_compras.map((compra) => ({
        evento_id: compra.evento_id,
        fecha_compra: compra.fecha_compra,
        monto: compra.monto,
      })),
    }));

    res.json({
      total: anonymizedUsers.length,
      fecha_exportacion: new Date(),
      usuarios: anonymizedUsers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:usuario_id - Obtener usuario (con caché Redis)
router.get("/:usuario_id", async (req, res) => {
  try {
    const { usuario_id } = req.params;

    // Intentar obtener de caché
    const cached = await req.redisClient.get(`user:${usuario_id}`);
    if (cached) {
      console.log("Cache hit for user:", usuario_id);
      return res.json(JSON.parse(cached));
    }

    // Si no está en caché, buscar en MongoDB
    const user = await User.findById(usuario_id).select(
      "-email_encrypted -nro_documento_hash"
    );

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    // Guardar en caché por 5 minutos (consistencia eventual)
    await req.redisClient.setEx(
      `user:${usuario_id}`,
      300,
      JSON.stringify(user)
    );

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/users/:usuario_id/compras - Obtener historial de compras
router.get("/:usuario_id/compras", async (req, res) => {
  try {
    const { usuario_id } = req.params;

    const user = await User.findById(usuario_id).select(
      "historial_compras nombre apellido email"
    );

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json({
      usuario_id: user._id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      total_compras: user.historial_compras.length,
      compras: user.historial_compras,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/users/:usuario_id/compras - Agregar compra al historial (uso interno)
router.put("/:usuario_id/compras", async (req, res) => {
  try {
    const { usuario_id } = req.params;
    const { evento_id, reserva_id, monto } = req.body;

    const user = await User.findById(usuario_id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    user.historial_compras.push({
      evento_id,
      reserva_id,
      monto,
      fecha_compra: new Date(),
    });

    await user.save();

    // Invalidar caché
    await req.redisClient.del(`user:${usuario_id}`);

    res.json({ message: "Compra agregada al historial" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
