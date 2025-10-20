const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const redis = require("redis")
require("dotenv").config()

const eventRoutes = require("./routes/eventRoutes")

const app = express()
const PORT = process.env.PORT || 3002

// Middleware
app.use(cors())
app.use(express.json())

// Redis Client
let redisClient
;(async () => {
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || "redis://localhost:6379",
  })

  redisClient.on("error", (err) => console.log("Redis Client Error", err))
  redisClient.on("connect", () => console.log("Redis Client Connected"))

  await redisClient.connect()
})()

// Make redis client available to routes
app.use((req, res, next) => {
  req.redisClient = redisClient
  next()
})

// MongoDB Connection
mongoose
  .connect(process.env.MONGODB_URI || "mongodb://localhost:27017/eventflow_events")
  .then(() => console.log("MongoDB Connected - Events Service"))
  .catch((err) => console.error("MongoDB Connection Error:", err))

// Routes
app.use("/api/eventos", eventRoutes)

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "events-service" })
})

app.listen(PORT, () => {
  console.log(`Events Service running on port ${PORT}`)
})

module.exports = app
