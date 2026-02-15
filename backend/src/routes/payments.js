const express = require("express");
const {
  createPesaPalOrder,
  handlePesapalIPN,
  paymentstatus,
  registerPesapalIPN,
  activateFreeTrial,
  submitAfterPayment,
  getAllPayments,
} = require("../controllers/paymentController");

const router = express.Router();

router.post("/pesapal/create", createPesaPalOrder);
router.post("/pesapal", handlePesapalIPN);
router.post("/status/:merchant_reference", paymentstatus);
router.post("/activate-trial", activateFreeTrial);

router.post("/cars/submit-after-payment", submitAfterPayment);

router.get("/register-ipn", registerPesapalIPN);
router.get("/", getAllPayments);

module.exports = router;
