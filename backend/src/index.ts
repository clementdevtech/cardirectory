import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import paymentRoutes from "./routes/payments";
import webhookRoutes from "./routes/webhooks";
import locationsRouter from "./routes/locations";
import auth from "./routes/auth";

dotenv.config();
const app = express();

//  Allowed frontend origins (adjust if needed)
const allowedOrigins = [
  "http://localhost:8080",
  "http://192.168.100.25:8080", // your device access
  "https://cardirectory.pages.dev",
];

// Secure CORS configuration for cookies/auth
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, // required for cookies / sessions
  })
);

app.use(bodyParser.json());

// Optional: ensure Express parses cookies correctly if needed
// import cookieParser from "cookie-parser";
// app.use(cookieParser());

app.use("/api/payments", paymentRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/locations", locationsRouter);
app.use("/api/auth", auth);

app.get("/", (req, res) => res.send("API running 🚀"));

app.listen(process.env.PORT || 5000, () =>
  console.log(`🚀 Server running on port ${process.env.PORT || 5000}`)
);