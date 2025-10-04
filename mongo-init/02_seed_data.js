db = db.getSiblingDB("eventflow");

// Insertar usuarios de ejemplo
db.usuarios.insertMany([
  {
    tipo_documento: "CI",
    nro_documento: "12345678",
    nombre: "Lucas",
    apellido: "Martínez",
    email: "lucas@gmail.com",
    historial_compras: [],
  },
  {
    tipo_documento: "CI",
    nro_documento: "23456789",
    nombre: "Ana",
    apellido: "González",
    email: "ana@gmail.com",
    historial_compras: [],
  },
]);

// Insertar eventos
db.eventos.insertMany([
  {
    nombre: "Concierto Rock",
    fecha: "10-12-2025",
    lugar: "Teatro Solís",
    aforo_total: 5000,
    entradas_disponibles: 5000,
  },
  {
    nombre: "Feria Tecnológica",
    fecha: "20-11-2025",
    lugar: "Centro de Convenciones",
    aforo_total: 2000,
    entradas_disponibles: 2000,
  },
]);
