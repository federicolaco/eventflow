const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const redis = require("redis");
require("dotenv").config();

const userRoutes = require("./routes/userRoutes");

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Redis Client
let redisClient;
(async () => {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
  });

  redisClient.on("error", (err) => console.log("Redis Client Error", err));
  redisClient.on("connect", () => console.log("Redis Client Connected"));

  await redisClient.connect();
})();

// Make redis client available to routes
app.use((req, res, next) => {
  req.redisClient = redisClient;
  next();
});

// MongoDB Connection
mongoose
  .connect(
    process.env.MONGODB_URI || "mongodb://localhost:27017/eventflow_users"
  )
  .then(() => console.log("MongoDB Connected - Users Service"))
  .catch((err) => console.error("MongoDB Connection Error:", err));

// Routes
app.use("/api/users", userRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "users-service" });
});

app.listen(PORT, () => {
  console.log(`Users Service running on port ${PORT}`);
});

module.exports = app;
