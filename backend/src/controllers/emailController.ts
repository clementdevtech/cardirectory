import { supabase } from "../supabaseClient";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const BRAND_LOGO = process.env.BRAND_LOGO || "https://yourdomain.com/logo.png";
const BRAND_NAME = process.env.BRAND_NAME || "CarDirectory Kenya";
const BRAND_COLOR = "#533737ff";

console.log("Email User:", EMAIL_USER ? "✅ Loaded" : "❌ Missing");
console.log("Email Pass:", EMAIL_PASS ? "✅ Loaded" : "❌ Missing");

// ✅ Setup transporter
const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ HTML Template Generator (with branding + responsiveness + dark mode)
const generateEmailTemplate = (
  title: string,
  message: string,
  buttonUrl?: string,
  buttonText?: string
): string => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<style>
  :root {
    color-scheme: light dark;
  }
  body {
    margin: 0;
    padding: 0;
    background-color: #f6f9fc;
    font-family: 'Arial', sans-serif;
    color: #333;
  }
  @media (prefers-color-scheme: dark) {
    body {
      background-color: #121212;
      color: #f0f0f0;
    }
    .container {
      background-color: #1e1e1e !important;
    }
  }
  .container {
    max-width: 600px;
    margin: 30px auto;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    overflow: hidden;
  }
  .header {
    background-color: ${BRAND_COLOR};
    padding: 20px;
    text-align: center;
  }
  .header img {
    width: 120px;
  }
  .body {
    padding: 30px;
  }
  .body h2 {
    color: ${BRAND_COLOR};
    margin-bottom: 15px;
  }
  .body p {
    font-size: 16px;
    line-height: 1.6;
  }
  .btn {
    display: inline-block;
    background-color: ${BRAND_COLOR};
    color: #fff !important;
    text-decoration: none;
    padding: 12px 24px;
    border-radius: 6px;
    margin-top: 20px;
    font-weight: bold;
  }
  .footer {
    text-align: center;
    font-size: 12px;
    color: #888;
    padding: 20px;
    background-color: #f1f1f1;
  }
  @media (prefers-color-scheme: dark) {
    .footer {
      background-color: #181818;
      color: #aaa;
    }
  }
  .social-icons img {
    width: 24px;
    margin: 0 6px;
  }
</style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="${BRAND_LOGO}" alt="${BRAND_NAME}" />
    </div>
    <div class="body">
      <h2>${title}</h2>
      <p>${message}</p>
      ${
        buttonUrl
          ? `<div style="text-align:center;">
              <a href="${buttonUrl}" class="btn">${buttonText || "Open Link"}</a>
             </div>`
          : ""
      }
    </div>
    <div class="footer">
      <div class="social-icons">
        <a href="https://facebook.com" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook"/></a>
        <a href="https://twitter.com" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" alt="Twitter"/></a>
        <a href="https://linkedin.com" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/733/733561.png" alt="LinkedIn"/></a>
      </div>
      <p>&copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

// ✅ Send Password Reset Email
export const sendPasswordResetEmail = async (email: string): Promise<{ error?: string }> => {
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${FRONTEND_URL}/reset-password`,
    });

    if (error) return { error: error.message };

    await transporter.sendMail({
      from: `"${BRAND_NAME} Support" <${EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Request",
      html: generateEmailTemplate(
        "Password Reset Request",
        "We received a request to reset your password. Please click below to proceed.",
        `${FRONTEND_URL}/reset-password`,
        "Reset Password"
      ),
    });

    console.log(`📧 Password reset email sent to ${email}`);
    return {};
  } catch (err: any) {
    console.error("⚠️ Unexpected error:", err);
    return { error: "Failed to send password reset email." };
  }
};

// ✅ Send Verification Email
export const sendVerificationEmail = async (email: string, verifyLink: string): Promise<{ error?: string }> => {
  console.log('running');
  try {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo: `${verifyLink}/verify-email`,
      },
    });

    if (error) return { error: error.message };

    await transporter.sendMail({
      from: `"${BRAND_NAME}" <${EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email Address",
      html: generateEmailTemplate(
        "Verify Your Email",
        "Thanks for joining! Please verify your email by clicking the button below.",
        `${verifyLink}/verify-email`,
        "Verify Email"
      ),
    });

    console.log(`✅ Verification email sent to ${email}`);
    return {};
  } catch (err: any) {
    console.error("⚠️ Unexpected error:", err);
    return { error: "Failed to send verification email." };
  }
};

// ✅ Send Normal or Mass Email
export const sendMassEmail = async (
  recipients: string[],
  subject: string,
  message: string
): Promise<{ success: boolean; failed?: string[] }> => {
  try {
    const results = await Promise.allSettled(
      recipients.map((email) =>
        transporter.sendMail({
          from: `"${BRAND_NAME} Updates" <${EMAIL_USER}>`,
          to: email,
          subject,
          html: generateEmailTemplate(subject, message),
        })
      )
    );

    const failed = results
      .map((r, i) => (r.status === "rejected" ? recipients[i] : null))
      .filter(Boolean) as string[];

    return { success: failed.length === 0, failed };
  } catch (err) {
    console.error("⚠️ Failed to send mass email:", err);
    return { success: false };
  }
};