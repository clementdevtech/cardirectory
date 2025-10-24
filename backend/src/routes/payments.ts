import express from "express";
import { createPesaPalOrder , handlePesapalIPN, paymentstatus, registerPesapalIPN, activateFreeTrial, submitAfterPayment } from "../controllers/paymentController";

const router = express.Router();
router.post("/pesapal/create", createPesaPalOrder);
router.post("/pesapal", handlePesapalIPN);
router.post("/status/:merchant_reference", paymentstatus)
router.post("/activate-trial", activateFreeTrial);

router.post("/cars/submit-after-payment", submitAfterPayment);

router.get("/register-ipn", registerPesapalIPN);
export default router;
