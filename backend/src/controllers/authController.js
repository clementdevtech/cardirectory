const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const { query, pool } = require("../db");
const { sendPasswordResetEmail, sendVerificationEmail } = require("./emailController");
const dotenv = require("dotenv");

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env["google-clientid"];
const GOOGLE_CLIENT_SECRET =
  process.env.GOOGLE_CLIENT_SECRET || process.env["google-clientsecret"];
const GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI ||
  (process.env.NODE_ENV === "production"
    ? "https://cardirectory.onrender.com/api/auth/google-callback"
    : "http://localhost:4000/api/auth/google-callback");

/* ======================================================
   📌 CREATE & SEND VERIFICATION EMAIL
====================================================== */
const sendVerificationLink = async (email, expiresIn = "1d") => {
  try {
    if (!JWT_SECRET || !FRONTEND_URL) {
      throw new Error("Missing JWT_SECRET or FRONTEND_URL environment variables.");
    }

    const token = jwt.sign({ email }, JWT_SECRET, { expiresIn });

    const verifyLink = `${FRONTEND_URL}/verify-email?token=${encodeURIComponent(
      token
    )}&email=${encodeURIComponent(email)}`;

    // Non-blocking email sending
    sendVerificationEmail(email, verifyLink).catch((err) =>
      console.error("❌ Verification email failed:", err)
    );

    return token;
  } catch (err) {
    console.error("❌ Error sending verification link:", err);
    throw err;
  }
};

/* ======================================================
   ✅ REGISTER USER
====================================================== */
const registerUser = async (req, res) => {
  try {
    const { email, password, fullName, phone } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ success: false, error: "All fields are required." });
    }

    const exists = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (exists.rows.length > 0) {
      return res
        .status(400)
        .json({ success: false, error: "Email already exists. Please log in." });
    }

    const hashed = await bcrypt.hash(password, 10);
    const token = await sendVerificationLink(email);

    const insert = `
      INSERT INTO users (full_name, email, password, role, phone, verification_token, is_verified, created_at)
      VALUES ($1, $2, $3, 'user', $4, $5, false, now())
      RETURNING id, full_name, email, role, created_at;
    `;

    const result = await query(insert, [fullName, email, hashed, phone || null, token]);

    return res.status(201).json({
      success: true,
      message:
        "Account created! Please check your email for a verification link before logging in.",
      user: result.rows[0],
    });
  } catch (err) {
    console.error("❌ registerUser error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/* ======================================================
   ✅ LOGIN USER
====================================================== */
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ success: false, error: "Email and password required." });

    const sql = `
      SELECT id, full_name, email, password, role, is_verified
      FROM users
      WHERE email = $1
      LIMIT 1
    `;
    const result = await query(sql, [email]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: "User not found." });

    const user = result.rows[0];

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ success: false, error: "Invalid credentials." });

    if (!user.is_verified) {
      const token = await sendVerificationLink(email);
      await query(`UPDATE users SET verification_token = $1 WHERE email = $2`, [token, email]);

      return res.status(403).json({
        success: false,
        error: "Your email is not verified. A new verification link has been sent.",
      });
    }

    const sessionToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("auth_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
      token: sessionToken,
    });
  } catch (err) {
    console.error("❌ loginUser error:", err);
    return res.status(500).json({ success: false, error: "Internal server error" });
  }
};

/* ======================================================
   ✅ GOOGLE LOGIN / REGISTRATION
====================================================== */
const googleLogin = (req, res) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({
      success: false,
      error: "Google login is not configured on the server.",
    });
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });

  return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
};

const googleCallback = async (req, res) => {
  try {
    const { code, error } = req.query;
    if (error || !code) {
      return res.redirect(`${FRONTEND_URL}/login?google_error=cancelled`);
    }

    const tokenResponse = await axios.post(
      "https://oauth2.googleapis.com/token",
      new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: GOOGLE_REDIRECT_URI,
        grant_type: "authorization_code",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const accessToken = tokenResponse.data?.access_token;
    if (!accessToken) throw new Error("Google did not return an access token.");

    const profileResponse = await axios.get(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    const profile = profileResponse.data;
    if (!profile.email || profile.email_verified !== true) {
      return res.redirect(`${FRONTEND_URL}/login?google_error=email_not_verified`);
    }

    const existing = await query(
      "SELECT id, full_name, email, role FROM users WHERE email = $1 LIMIT 1",
      [profile.email]
    );

    let user;
    if (existing.rows.length > 0) {
      const result = await query(
        `UPDATE users
         SET is_verified = true, full_name = COALESCE(NULLIF(full_name, ''), $1)
         WHERE id = $2
         RETURNING id, full_name, email, role`,
        [profile.name || profile.email.split("@")[0], existing.rows[0].id]
      );
      user = result.rows[0];
    } else {
      const generatedPassword = await bcrypt.hash(
        `${profile.sub}:${JWT_SECRET}`,
        10
      );
      const result = await query(
        `INSERT INTO users
          (full_name, email, password, role, is_verified, created_at)
         VALUES ($1, $2, $3, 'user', true, now())
         RETURNING id, full_name, email, role`,
        [profile.name || profile.email.split("@")[0], profile.email, generatedPassword]
      );
      user = result.rows[0];
    }

    const sessionToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("auth_token", sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(`${FRONTEND_URL}/?google_login=success`);
  } catch (err) {
    console.error("Google authentication error:", err.response?.data || err.message);
    return res.redirect(`${FRONTEND_URL}/login?google_error=failed`);
  }
};

/* ======================================================
   ✅ LOGOUT
====================================================== */
const logoutUser = async (_, res) => {
  try {
    res.clearCookie("auth_token");
    return res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch {
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

/* ======================================================
   ✅ FORGOT PASSWORD
====================================================== */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    const user = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (user.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    sendPasswordResetEmail(email).catch((err) =>
      console.error("❌ reset email failed:", err)
    );

    return res.json({
      success: true,
      message: "Password reset email sent. Check your inbox.",
    });
  } catch (err) {
    console.error("❌ forgotPassword error:", err);
    return res.status(500).json({ error: "Internal error" });
  }
};

/* ======================================================
   ✅ RESET PASSWORD
====================================================== */
const resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword)
      return res.status(400).json({ error: "Missing token or password" });

    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded || !decoded.email)
      return res.status(400).json({ error: "Invalid token" });

    const hashed = await bcrypt.hash(newPassword, 10);

    await query("UPDATE users SET password = $1 WHERE email = $2", [
      hashed,
      decoded.email,
    ]);

    return res.json({ success: true, message: "Password reset successful" });
  } catch (err) {
    return res.status(400).json({ error: "Invalid or expired token" });
  }
};

/* ======================================================
   ✅ VERIFY EMAIL ENDPOINT (GET)
====================================================== */
const verifyEmailStatus = async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer "))
      return res.status(400).json({ verified: false, error: "Missing token" });

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded || !decoded.email)
      return res.status(400).json({ verified: false, error: "Invalid token" });

    await pool.query("UPDATE users SET is_verified = true WHERE email = $1", [
      decoded.email,
    ]);

    return res.json({ verified: true });
  } catch (err) {
    console.error("verifyEmail error:", err);
    return res.status(400).json({ verified: false, error: "Invalid or expired token" });
  }
};

/* ======================================================
   ✅ RESEND VERIFICATION
====================================================== */
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "Email required" });

    const { rows } = await pool.query(
      `SELECT is_verified, last_verification_sent_at 
       FROM users WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (rows.length === 0)
      return res.status(404).json({ error: "No account found" });

    const user = rows[0];

    if (user.is_verified)
      return res.status(400).json({ error: "Email is already verified." });

    if (user.last_verification_sent_at) {
      const diffSeconds =
        (Date.now() - new Date(user.last_verification_sent_at).getTime()) / 1000;
      if (diffSeconds < 60)
        return res.status(429).json({
          error: `Wait ${60 - Math.floor(diffSeconds)}s before requesting again.`,
        });
    }

    const token = await sendVerificationLink(email);

    await pool.query(
      `UPDATE users SET verification_token = $1, last_verification_sent_at = now()
       WHERE email = $2`,
      [token, email]
    );

    return res.json({
      success: true,
      message: "Verification link sent again. Check your inbox.",
    });
  } catch (err) {
    console.error("❌ resendVerification error:", err);
    return res.status(500).json({ error: "Failed to resend verification." });
  }
};

/* ======================================================
   ✅ GET USER PROFILE (ME)
====================================================== */
const getMe = async (req, res) => {
  try {
    const bearer = req.headers.authorization?.split(" ")[1];
    const token = bearer || req.cookies?.auth_token;

    if (!token)
      return res.status(401).json({ success: false, error: "Unauthorized" });

    const decoded = jwt.verify(token, JWT_SECRET);

    const result = await query(
      "SELECT id, full_name, email, role, is_verified FROM users WHERE id = $1 LIMIT 1",
      [decoded.id]
    );

    if (result.rows.length === 0)
      return res.status(404).json({ error: "User not found" });

    const user = result.rows[0];

    return res.json({
      success: true,
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
        is_verified: user.is_verified,
      },
    });
  } catch (err) {
    return res.status(401).json({ error: "Unauthorized" });
  }
};

module.exports = {
  sendVerificationLink,
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  resetPassword,
  verifyEmailStatus,
  resendVerification,
  getMe,
  googleLogin,
  googleCallback,
};
