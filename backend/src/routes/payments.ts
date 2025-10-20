import express from "express";
import { createPesaPalOrder , handlePesapalIPN } from "../controllers/paymentController";

const router = express.Router();
router.post("/pesapal/create", createPesaPalOrder);
router.post("/pesapal/ipn", handlePesapalIPN);
export default router;
