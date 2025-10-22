import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import bodyParser from "body-parser";
import paymentRoutes from "./routes/payments";
import locationsRouter from "./routes/locations";
import auth from "./routes/auth";
import emailRoutes from "./routes/emailRoutes";import cookieParser from "cookie-parser";


dotenv.config();
const app = express();

//  Allowed frontend origins
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


app.use("/api/payments", paymentRoutes);
app.use("/api/webhooks", paymentRoutes);
app.use("/api/locations", locationsRouter);
app.use("/api/auth", auth);
app.use("/api/email", emailRoutes);

app.get("/", (req, res) => res.send("API running 🚀"));

app.listen(process.env.PORT || 5000, () =>
  console.log(`🚀 Server running on port ${process.env.PORT || 5000}`)
);