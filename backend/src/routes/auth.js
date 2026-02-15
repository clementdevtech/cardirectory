const express = require("express");
const {
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  verifyEmailStatus,
  getMe,
  resendVerification,
} = require("../controllers/authController");

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.post("/forgot-password", forgotPassword);
router.get("/verify-email", verifyEmailStatus);
router.post("/resend-verification", resendVerification);
router.get("/me", getMe);

module.exports = router;
