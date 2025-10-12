const mongoose = require("mongoose");
const crypto = require("crypto");

const userSchema = new mongoose.Schema(
  {
    tipo_documento: {
      type: String,
      required: true,
      enum: ["DNI", "Pasaporte", "Cedula", "Otro"],
    },
    nro_documento: {
      type: String,
      required: true,
      unique: true,
    },
    // Datos seudonimizados para privacidad
    nro_documento_hash: {
      type: String,
      unique: true,
    },
    nombre: {
      type: String,
      required: true,
    },
    apellido: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
    },
    // Email encriptado para privacidad
    email_encrypted: {
      type: String,
    },
    historial_compras: [
      {
        evento_id: {
          type: String,
          required: true,
        },
        reserva_id: {
          type: String,
          required: true,
        },
        fecha_compra: {
          type: Date,
          default: Date.now,
        },
        monto: {
          type: Number,
          required: true,
        },
      },
    ],
    fecha_registro: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para optimizar consultas de lectura
userSchema.index({ email: 1 });
userSchema.index({ nro_documento_hash: 1 });

// Método para encriptar datos sensibles (seudonimización)
userSchema.methods.encryptSensitiveData = function () {
  const algorithm = "aes-256-cbc";
  const key = Buffer.from(
    process.env.ENCRYPTION_KEY || "12345678901234567890123456789012",
    "utf8"
  );
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(this.email, "utf8", "hex");
  encrypted += cipher.final("hex");

  this.email_encrypted = iv.toString("hex") + ":" + encrypted;
};

// Método para crear hash del documento (seudonimización)
userSchema.pre("save", function (next) {
  if (this.isModified("nro_documento")) {
    this.nro_documento_hash = crypto
      .createHash("sha256")
      .update(this.nro_documento)
      .digest("hex");
  }
  next();
});

module.exports = mongoose.model("User", userSchema);
