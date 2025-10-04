// Conectar a la base admin por defecto
db = db.getSiblingDB("eventflow");

// Crear colecciones si no existen
if (!db.getCollectionNames().includes("usuarios"))
  db.createCollection("usuarios");
if (!db.getCollectionNames().includes("eventos"))
  db.createCollection("eventos");
if (!db.getCollectionNames().includes("reservas"))
  db.createCollection("reservas");
