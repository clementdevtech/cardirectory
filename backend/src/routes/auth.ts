import express from "express";
import {
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  verifyEmailStatus,
  getMe,
} from "../controllers/authController";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/logout", logoutUser);
router.post("/forgot-password", forgotPassword);
router.get("/verify-email", verifyEmailStatus);
router.get("/me", getMe);

export default router;
