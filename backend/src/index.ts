import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";

import paymentRoutes from "./routes/payments";
import locationsRouter from "./routes/locations";
import auth from "./routes/auth";
import emailRoutes from "./routes/emailRoutes";
import adminRoutes from "./routes/adminRoutes";
import oauthRouter from  "./routes/emailAuth";


dotenv.config();

const app = express();

// ✅ Allowed frontend origins
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

app.use(bodyParser.json());
app.use(cookieParser());

// ✅ API routes
app.use("/api/payments", paymentRoutes);
app.use("/api/webhooks", paymentRoutes);
app.use("/api/locations", locationsRouter);
app.use("/api/auth", auth);
app.use("/api/email", emailRoutes);
app.use("/api/admin", adminRoutes);
app.use("/oauth", oauthRouter);

// ✅ Health check endpoint for Render
app.get("/", (req, res) => res.send("✅ Cardirectory API running 🚀"));

// ✅ Handle unknown routes gracefully
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// ✅ PORT & HOST (Render requirement)
const PORT = Number(process.env.PORT) || 5000;
const HOST = "0.0.0.0";

// ✅ Start server
app.listen(PORT, HOST, () => {
  console.log(`🚀 Server running on http://${HOST}:${PORT}`);
});
