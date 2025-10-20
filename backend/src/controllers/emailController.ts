import { supabase } from "../supabaseClient";
import dotenv from "dotenv";

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || "https://cardirectory.pages.dev";

/**
 * Sends a password reset email using Supabase's built-in email service.
 */
export const sendPasswordResetEmail = async (email: string): Promise<{ error?: string }> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${FRONTEND_URL}/reset-password`,
    });

    if (error) {
      console.error("❌ Supabase reset password error:", error.message);
      return { error: error.message };
    }

    console.log(`📧 Password reset email sent to ${email}`);
    return {};
  } catch (err: any) {
    console.error("⚠️ Unexpected error in sendPasswordResetEmail:", err);
    return { error: "Failed to send password reset email." };
  }
};

/**
 * Sends an email verification link using Supabase's built-in email service.
 */
export const sendVerificationEmail = async (email: string): Promise<{ error?: string }> => {
  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${FRONTEND_URL}/verify-email`,
      },
    });

    if (error) {
      console.error("❌ Supabase verification email error:", error.message);
      return { error: error.message };
    }

    console.log(`✅ Verification email sent to ${email}`);
    return {};
  } catch (err: any) {
    console.error("⚠️ Unexpected error in sendVerificationEmail:", err);
    return { error: "Failed to send verification email." };
  }
};
