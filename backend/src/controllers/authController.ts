import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt, { SignOptions } from "jsonwebtoken";
import { query } from "../db"; // ✅ your pg helper
import { sendPasswordResetEmail, sendVerificationEmail } from "./emailController"; // keep if you use it for reset emails
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET as string;
const FRONTEND_URL = process.env.FRONTEND_URL

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

    const verifyLink = `${FRONTEND_URL}/verify-email?token=${verificationToken}`;

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
      SELECT id, full_name, email, password, role, created_at, email_verified
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
    if (!user.email_verified) {
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

/* ===========================
   ✅ VERIFY EMAIL STATUS (GET)
=========================== */
export const verifyEmailStatus = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { token } = req.query;

    console.log(token);

    if (!token) {
      return res.status(400).json({ success: false, error: "Missing verification token" });
    }

    // Check token in database
    const result = await query("SELECT id, email, is_verified FROM users WHERE verification_token = $1", [token]);

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: "Invalid or expired verification token" });
    }

    const user = result.rows[0];

    if (user.is_verified) {
      return res.status(200).json({ success: true, message: "Email already verified" });
    }

    // Mark user as verified
    await query("UPDATE users SET is_verified = true, verification_token = NULL WHERE id = $1", [user.id]);

    return res.status(200).json({
      success: true,
      message: "Email verified successfully!",
      verified: true,
    });
  } catch (err) {
    console.error("❌ verifyEmailStatus error:", err);
    return res.status(500).json({ success: false, error: "Internal Server Error" });
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