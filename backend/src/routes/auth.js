const express = require("express");
const {
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  verifyEmailStatus,
  getMe,
  resendVerification,
  googleLogin,
  googleCallback,
  googleExchange,
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.post("/forgot-password", forgotPassword);
router.get("/verify-email", verifyEmailStatus);
router.post("/resend-verification", resendVerification);
router.get("/me", getMe);
router.get("/google", googleLogin);
router.get("/google-callback", googleCallback);
router.post("/google/exchange", googleExchange);

module.exports = router;
