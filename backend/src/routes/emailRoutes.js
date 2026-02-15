const express = require("express");
const { sendPasswordResetEmail, sendVerificationEmail, sendMassEmail } = require("../controllers/emailController");

const router = express.Router();

// Verification email
router.post("/verify", async (req, res) => {
  const { email, verifyLink } = req.body;
  const result = await sendVerificationEmail(email, verifyLink);
  if (result.error) return res.status(400).json(result);
  res.json({ message: "Verification email sent successfully!" });
});

// Password reset email
router.post("/reset", async (req, res) => {
  const { email } = req.body;
  const result = await sendPasswordResetEmail(email);
  if (result.error) return res.status(400).json(result);
  res.json({ message: "Password reset email sent successfully!" });
});

// Mass or normal email
router.post("/mass", async (req, res) => {
  const { recipients, subject, message } = req.body;
  if (!Array.isArray(recipients) || !recipients.length) {
    return res.status(400).json({ error: "Recipients list is required." });
  }
  const result = await sendMassEmail(recipients, subject, message);
  res.json(result);
});

module.exports = router;
