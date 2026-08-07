require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const hpp = require("hpp");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const dns = require("dns");

const DB_Connect = require("../config/db.js");
const errorMiddleware = require("../Middleware/ErrorMiddleware.js");

const userRoute = require("../Routes/UserRoute.js");
const PaymentRoute = require("../Routes/PaymentRoute.js");

const app = express();

// ============================
// DNS CONFIGURATION
// ============================

dns.setDefaultResultOrder("ipv4first");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// ============================
// BASIC CONFIG
// ============================

const PORT = process.env.PORT || 5000;

app.disable("x-powered-by");
app.set("trust proxy", 1);

// ============================
// SECURITY
// ============================

app.use(
  helmet({
    crossOriginResourcePolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

app.use(compression());

app.use(hpp());

app.use(
  cors({
    origin:[
  // process.env.CLIENT_URL
  http://localhost:5173
].filter(Boolean),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"]
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// ============================
// LOGGER
// ============================

app.use(
  morgan(process.env.NODE_ENV === "production" ? "combined" : "dev")
);

// ============================
// RATE LIMITER
// ============================

const limiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 Minutes
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests. Please try again after 5 minutes."
  }
});

app.use("/api", limiter);

// ============================
// HEALTH CHECK
// ============================

app.get("/api/health", (req, res) => {
  res.status(200).json({
    success: true,
    status: "OK",
    uptime: process.uptime(),
    timestamp: new Date(),
    environment: process.env.NODE_ENV
  });
});

// ============================
// ROUTES
// ============================

app.use("/api/user", userRoute);
app.use("/api/payment", PaymentRoute);

// ============================
// ERROR HANDLER
// ============================

app.use(errorMiddleware);

// ============================
// DATABASE
// ============================

DB_Connect();

// ============================
// START SERVER
// ============================

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

// ============================
// PROCESS EVENTS
// ============================

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

process.on("SIGINT", () => {
  console.log("Server shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Server terminated.");
  process.exit(0);
});
