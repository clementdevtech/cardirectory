const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");

// Routes
const paymentRoutes = require("./routes/payments");
const locationsRouter = require("./routes/locations");
const auth = require("./routes/auth");
const emailRoutes = require("./routes/emailRoutes");
const adminRoutes = require("./routes/adminRoutes");
const dealerCarsRoutes = require("./routes/dealerRoutes");
const oauthRouter = require("./routes/emailAuth");

// 🕒 Cron jobs
const { startSubscriptionExpiryJob } = require("./jobs/expireSubscriptions");
require("./jobs/expiry-notify"); // auto-starts on import

dotenv.config();

const app = express();

/* ======================================================
   CORS
====================================================== */
const allowedOrigins = [
  "http://localhost:8080",
  "http://192.168.100.25:8080",
  "https://cardirectory.pages.dev",
  "https://cardirectory.co.ke",
  "https://www.cardirectory.co.ke",
];

app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

/* ======================================================
   Middleware
====================================================== */
app.use(bodyParser.json({ limit: "10mb" }));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cookieParser());

/* ======================================================
   Routes
====================================================== */
app.use("/api/payments", paymentRoutes);
app.use("/api/webhooks", paymentRoutes);

app.use("/api/locations", locationsRouter);
app.use("/api/auth", auth);
app.use("/api/email", emailRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/dealer", dealerCarsRoutes);
app.use("/oauth", oauthRouter);

/* ======================================================
   Health check
====================================================== */
app.get("/", (req, res) => {
  res.send("✅ Cardirectory API running 🚀");
});

/* ======================================================
   404 handler
====================================================== */
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

/* ======================================================
   Server start
====================================================== */
const PORT = Number(process.env.PORT) || 4000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);

  // 🕛 Nightly expiry job (auto-expire + grace period)
  startSubscriptionExpiryJob();

  console.log("🕒 Cron jobs initialized");
});
