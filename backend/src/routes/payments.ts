import express from "express";
import { createPesaPalOrder , handlePesapalIPN, registerPesapalIPN } from "../controllers/paymentController";

const router = express.Router();
router.post("/pesapal/create", createPesaPalOrder);
router.post("/pesapal/ipn", handlePesapalIPN);
router.get("/register-ipn", registerPesapalIPN);
export default router;
