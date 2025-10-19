import { Request, Response } from "express";
import { supabase } from "../supabaseClient";
import { sendPasswordResetEmail } from "./emailController";
import { pool } from "../db";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


const JWT_SECRET = process.env.JWT_SECRET;

// ✅ REGISTER USER
export const registerUser = async (req, res) => {
  try {
    const { email, password, fullName, phone } = req.body;

    if (!email || !password || !fullName) {
      return res.status(400).json({ success: false, error: "All fields are required." });
    }

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from("users")
      .select("*")
      .eq("email", email)
      .single();

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: "Email already exists. Please log in or use another email.",
      });
    }

    // Create user in Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, phone },
        emailRedirectTo: `${process.env.FRONTEND_URL}/verify-email`,
      },
    });

    if (error) {
      console.error("❌ Registration error:", error.message);
      return res.status(400).json({ success: false, error: error.message });
    }

    return res.status(200).json({
      success: true,
      message:
        "Account created successfully! Please check your email to verify your account before logging in.",
    });
  } catch (err) {
    console.error("❌ registerUser unexpected error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};

// ✅ LOGIN USER
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      // 📨 Handle unverified email case
      if (error.code === "email_not_confirmed") {
        console.warn("⚠️ Email not confirmed, resending verification link...");

        await supabase.auth.resend({
          type: "signup",
          email,
          options: { emailRedirectTo: `${process.env.FRONTEND_URL}/verify-email` },
        });

        return res.status(403).json({
          success: false,
          error:
            "Your account isn't verified yet. We've resent the verification email. Please check your inbox.",
        });
      }

      console.error("❌ Login error:", error.message);
      return res.status(400).json({ success: false, error: error.message });
    }

    // ✅ Generate 7-day token
    const token = jwt.sign(
      { id: data.user.id, email: data.user.email },
      JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      user: data.user,
      session: data.session,
      token,
    });
  } catch (err) {
    console.error("❌ loginUser unexpected error:", err);
    return res.status(500).json({ success: false, error: "Internal server error." });
  }
};


/**
 * Logs out the current user.
 */
export const logoutUser = async (req: Request, res: Response) => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) return res.status(400).json({ error: error.message });

    return res.status(200).json({ message: "Logged out successfully" });
  } catch (err: any) {
    console.error("❌ logoutUser error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

/**
 * Handles forgot password and sends reset email.
 */
export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ error: "Email is required" });

    const { error } = await sendPasswordResetEmail(email);
    if (error) return res.status(400).json({ error });

    return res.status(200).json({
      message: "Password reset email sent. Check your inbox.",
    });
  } catch (err: any) {
    console.error("❌ forgotPassword error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};
 

/**
 * Verifies if the user's email is confirmed in Supabase.
 * The frontend should call this after a user clicks the verification link.
 */
export const verifyEmailStatus = async (req: Request, res: Response) => {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      return res.status(401).json({ error: "Missing or invalid authorization token" });
    }

    // Get the user info from the access token
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data?.user) {
      return res.status(400).json({ error: error?.message || "Invalid token" });
    }

    const user = data.user;

    if (user.email_confirmed_at) {
      return res.status(200).json({
        message: "Email verified successfully",
        verified: true,
        user,
      });
    } else {
      return res.status(200).json({
        message: "Email not yet verified",
        verified: false,
      });
    }
  } catch (err: any) {
    console.error("❌ verifyEmailStatus error:", err);
    return res.status(500).json({ error: "Internal Server Error" });
  }
};

export const getMe = async (req: Request, res: Response) => {
  try {
    // Get token from either cookie or bearer
    const bearer = req.headers.authorization?.split(" ")[1];
    const token = bearer || req.cookies?.auth_token;

    if (!token) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify JWT
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string };

    // Fetch user with role from DB
    const result = await pool.query(
      "SELECT id, email, role FROM users WHERE id = $1 LIMIT 1",
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const user = result.rows[0];

    return res.status(200).json({
      user: { id: user.id, email: user.email, role: user.role, },
      role: user.role || "user",
    });
  } catch (err) {
    console.error("❌ /auth/me error:", err);
    return res.status(401).json({ error: "Unauthorized" });
  }
};