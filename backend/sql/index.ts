import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import paymentsRoute from "./routes/payments";
import webhooksRoute from "./routes/webhooks";
import dealersRoute from "./routes/dealers";
import { log } from "./logger";

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.get("/", (req, res) => res.send("Auto Kenya API"));

app.use("/payments", paymentsRoute);
app.use("/webhooks", webhooksRoute);
app.use("/dealers", dealersRoute);

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  log.info(`Server listening on ${port}`);
});
