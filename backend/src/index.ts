import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

// Routes
import paymentRoutes from "./routes/payments";
import locationsRouter from "./routes/locations";
import auth from "./routes/auth";
import emailRoutes from "./routes/emailRoutes";
import adminRoutes from "./routes/adminRoutes";
import dealerCarsRoutes from "./routes/dealerRoutes";
import oauthRouter from "./routes/emailAuth";
import carsRouter from "./routes/cars";

// 🕒 Cron jobs
import { startSubscriptionExpiryJob } from "./jobs/expireSubscriptions";
import "./jobs/expiry-notify"; // auto-starts on import

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
app.use("/api/cars", carsRouter);

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
const PORT = Number(process.env.PORT) || 5000;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);

  // 🕛 Nightly expiry job (auto-expire + grace period)
  startSubscriptionExpiryJob();

  console.log("🕒 Cron jobs initialized");
});
