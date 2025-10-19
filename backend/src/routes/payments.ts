import express from "express";
import { handlePesaPalWebhook } from "../controllers/pesapalWebhook";
import { createPesaPalOrder , handlePesapalIPN } from "../controllers/paymentController";

const router = express.Router();
router.post("/webhooks/pesapal", handlePesaPalWebhook);
router.post("/pesapal/create", createPesaPalOrder);
router.post("/pesapal/ipn", handlePesapalIPN);
export default router;
