// index.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();

const paymentsRoute = require("./routes/payments");
const webhooksRoute = require("./routes/webhooks");
const dealersRoute = require("./routes/dealers");
const { log } = require("./logger");

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Health check
app.get("/", (req, res) => res.send("Auto Kenya API"));

// Routes
app.use("/payments", paymentsRoute);
app.use("/webhooks", webhooksRoute);
app.use("/dealers", dealersRoute);

// Start server
const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  log.info(`Server listening on ${port}`);
});
