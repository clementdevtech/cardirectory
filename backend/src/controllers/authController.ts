import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { SignOptions, JwtPayload } from "jsonwebtoken";
import { query, pool } from "../db"; // ✅ your pg helper
import { sendPasswordResetEmail, sendVerificationEmail } from "./emailController"; // keep if you use it for reset emails
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string;
const FRONTEND_URL = process.env.FRONTEND_URL;

export const sendVerificationLink = async (
  email: string,
  expiresIn: string | number = "1d"
): Promise<string> => {
  try {
    if (!JWT_SECRET || !FRONTEND_URL) {
      throw new Error("Missing JWT_SECRET or FRONTEND_URL environment variables.");
    }

    const options: SignOptions = {
      expiresIn: expiresIn as jwt.SignOptions["expiresIn"],
    };

    const verificationToken = jwt.sign({ email }, JWT_SECRET as string, options);

    const verifyLink = `${FRONTEND_URL}/verify-email?token=${encodeURIComponent(verificationToken)}&email=${encodeURIComponent(email)}`;

    await sendVerificationEmail(email, verifyLink);

    return verificationToken;
  } catch (err) {
    console.error("❌ Error sending verification link:", err);
    throw err;
  }
};

// ✅ REGISTER USER
export const registerUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password, fullName, phone } = req.body as {
      email: string;
      password: string;
      fullName: string;
      phone?: string;
    };

    if (!email || !password || !fullName) {
      return res.status(400).json({ success: false, error: "All fields are required." });
    }

    const existingUser = await query(`SELECT id FROM users WHERE email = $1`, [email]);
    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: "Email already exists. Please log in or use another email.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    // 📤 Use reusable verification logic
    const verificationToken = await sendVerificationLink(email);

    const insertSQL = `
      INSERT INTO users (full_name, email, password, role, phone, verification_token, is_verified, created_at)
      VALUES ($1, $2, $3, 'user', $4, $5, false, now())
      RETURNING id, full_name, email, role, created_at
    `;
    const result = await query(insertSQL, [fullName, email, hashedPassword, phone || null, verificationToken]);

    return res.status(201).json({
      success: true,
      message:
        "Account created successfully! Please check your email to verify your account before logging in.",
      user: result.rows[0],
    });
  } catch (err: any) {
    console.error("❌ registerUser unexpected error:", err);
    if (err.code === "23505") {
      return res.status(400).json({
        success: false,
        error: "This email is already registered. Try logging in instead.",
      });
    }
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ✅ LOGIN USER
export const loginUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email and password are required." });
    }

    // 1️⃣ Get user from database
    const sql = `
      SELECT id, full_name, email, password, role, created_at, is_verified
      FROM users
      WHERE email = $1
      LIMIT 1
    `;
    const result = await query(sql, [email]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    const user = result.rows[0];

    // 2️⃣ Check password first
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, error: "Invalid credentials." });
    }

    // 3️⃣ If email not verified — generate + save new token
    if (!user.is_verified) {
      const verificationToken = await sendVerificationLink(email);

      // 🧩 Store token in the database
      await query(
        `UPDATE users SET verification_token = $1, updated_at = now() WHERE email = $2`,
        [verificationToken, email]
      );

      return res.status(403).json({
        success: false,
        error:
          "Your email address is not verified. A new verification link has been sent to your inbox.",
      });
    }

    // 4️⃣ Create JWT token for successful login
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    // 5️⃣ Set secure cookie
    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    // 6️⃣ Respond success
    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        full_name: user.full_name,
        email: user.email,
        role: user.role,
      },
      token,
    });
  } catch (err) {
    console.error("❌ loginUser unexpected error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};




/* ===========================
   ✅ LOGOUT USER
=========================== */
export const logoutUser = async (req: Request, res: Response): Promise<Response> => {
  try {
    res.clearCookie("auth_token");
    return res.status(200).json({ success: true, message: "Logged out successfully" });
  } catch (err) {
    console.error("❌ logoutUser error:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};

/* ===========================
   ✅ FORGOT PASSWORD
=========================== */
export const forgotPassword = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email } = req.body as { email: string };

    if (!email) return res.status(400).json({ success: false, error: "Email is required" });

    const result = await query("SELECT id FROM users WHERE email = $1", [email]);
    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: "User not found" });

    await sendPasswordResetEmail(email);
    return res.status(200).json({
      success: true,
      message: "Password reset email sent. Check your inbox.",
    });
  } catch (err) {
    console.error("❌ forgotPassword error:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
  }
};


export const resetPassword = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: "Missing token or password" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as JwtPayload;
    if (!decoded?.email) {
      return res.status(400).json({ success: false, error: "Invalid token" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await query("UPDATE users SET password = $1 WHERE email = $2", [hashed, decoded.email]);

    return res.json({ success: true, message: "Password reset successful" });
  } catch (err: any) {
    console.error("❌ resetPassword error:", err.message);
    return res.status(400).json({ success: false, error: "Invalid or expired token" });
  }
};


/* ===========================
   ✅ VERIFY EMAIL STATUS (GET)
=========================== */
export const verifyEmailStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(400).json({ verified: false, error: "Missing token" });
    }

    const token = header.split(" ")[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Decoded OK:", decoded);

    // ✅ Type guard to ensure it's a JwtPayload
    if (typeof decoded !== "object" || !("email" in decoded)) {
      return res.status(400).json({ verified: false, error: "Invalid token payload" });
    }

    const email = (decoded as JwtPayload).email as string;

    if (!email) {
      return res.status(400).json({ verified: false, error: "Email missing in token" });
    }

    await pool.query("UPDATE users SET is_verified = true WHERE email = $1", [email]);

    return res.json({ verified: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown verification error";
    console.error("verifyEmail error:", message);
    return res.status(400).json({ verified: false, error: message });
  }
};

/* resendverification email*/

export const resendVerification = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: "Email is required." });
    }

    // 🔍 1. Fetch user + last_verification_sent_at
    const { rows } = await pool.query(
      "SELECT id, is_verified, last_verification_sent_at FROM users WHERE email = $1 LIMIT 1",
      [email]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: "No account found with that email." });
    }

    const user = rows[0];

    // ✅ 2. If already verified, no need to resend
    if (user.is_verified) {
      return res.status(400).json({ error: "This email is already verified." });
    }

    // ⏱ 3. Check cooldown (60 seconds)
    if (user.last_verification_sent_at) {
      const lastSent = new Date(user.last_verification_sent_at).getTime();
      const now = Date.now();
      const diffSeconds = Math.floor((now - lastSent) / 1000);

      if (diffSeconds < 60) {
        return res.status(429).json({
          error: `Please wait ${60 - diffSeconds}s before requesting another verification email.`,
        });
      }
    }

    // ✉️ 4. Generate new verification token + link
    const token = await sendVerificationLink(email);

    // 💾 5. Save token + update last_verification_sent_at
    await pool.query(
      `UPDATE users 
       SET verification_token = $1, last_verification_sent_at = now()
       WHERE email = $2`,
      [token, email]
    );

    // ✅ 6. Respond success
    return res.json({
      success: true,
      message: "Verification email sent successfully. Check your inbox!",
    });
  } catch (err: any) {
    console.error("❌ resendVerification error:", err.message);
    return res.status(500).json({ error: "Failed to send verification email." });
  }
};

/* ===========================
   ✅ GET AUTHENTICATED USER
=========================== */
export const getMe = async (req: Request, res: Response): Promise<Response> => {
  try {
    const bearer = req.headers.authorization?.split(" ")[1];
    const token = bearer || req.cookies?.auth_token;

    if (!token) return res.status(401).json({ success: false, error: "Unauthorized" });

    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };

    const result = await query("SELECT id, full_name, email, role, is_verified FROM users WHERE id = $1 LIMIT 1", [decoded.id]);

    if (result.rows.length === 0)
      return res.status(404).json({ success: false, error: "User not found" });

    const user = result.rows[0];
    return res.status(200).json({
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
    console.error("❌ getMe error:", err);
    return res.status(401).json({ success: false, error: "Unauthorized" });
  }
};