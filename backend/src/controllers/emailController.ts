import { query } from "../db";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const BRAND_LOGO = process.env.BRAND_LOGO;
const BRAND_NAME = process.env.BRAND_NAME || "CarDirectory";
const BRAND_COLOR = "#533737ff";

console.log("Email User:", EMAIL_USER ? "✅ Loaded" : "❌ Missing");
console.log("Email Pass:", EMAIL_PASS ? "✅ Loaded" : "❌ Missing");

// ✅ Setup transporter
const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

// ✅ HTML Template Generator
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
  :root { color-scheme: light dark; }
  body {
    margin: 0;
    padding: 0;
    background-color: #f6f9fc;
    font-family: 'Arial', sans-serif;
    color: #333;
  }
  @media (prefers-color-scheme: dark) {
    body { background-color: #121212; color: #f0f0f0; }
    .container { background-color: #1e1e1e !important; }
  }
  .container {
    max-width: 600px;
    margin: 30px auto;
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    overflow: hidden;
  }
  .header { background-color: ${BRAND_COLOR}; padding: 20px; text-align: center; }
  .header img { width: 120px; }
  .body { padding: 30px; }
  .body h2 { color: ${BRAND_COLOR}; margin-bottom: 15px; }
  .body p { font-size: 16px; line-height: 1.6; }
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
    .footer { background-color: #181818; color: #aaa; }
  }
  .social-icons img { width: 24px; margin: 0 6px; }
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
        <a href="https://www.facebook.com/profile.php?id=61582717470790" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" alt="Facebook"/></a>
        <a href="https://x.com/cardirectory1?t=D5VKSzwZdroYZcZ77sdaUg&s=09" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" alt="Twitter"/></a>
        <a href="https://www.instagram.com/car.directory?igsh=MTYycmJnaWtiOTh1ZQ==" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/733/733561.png" alt="LinkedIn"/></a>
      </div>
      <p>&copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>
`;

/* ----------------------------------------------------------
   PASSWORD RESET EMAIL (using db instead of Supabase)
----------------------------------------------------------- */
export const sendPasswordResetEmail = async (email: string): Promise<{ error?: string }> => {
  try {
    const token = Math.random().toString(36).substring(2, 15);
    const expiry = new Date(Date.now() + 1000 * 60 * 15); // 15 minutes

    await query(
      `INSERT INTO password_resets (email, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET token = $2, expires_at = $3`,
      [email, token, expiry]
    );

    const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;

    await transporter.sendMail({
      from: `"${BRAND_NAME} Support" <${EMAIL_USER}>`,
      to: email,
      subject: "Password Reset Request",
      html: generateEmailTemplate(
        "Password Reset Request",
        "We received a request to reset your password. Please click below to proceed.",
        resetLink,
        "Reset Password"
      ),
    });

    console.log(`📧 Password reset email sent to ${email}`);
    return {};
  } catch (err: any) {
    console.error("⚠️ Password Reset Error:", err);
    return { error: "Failed to send password reset email." };
  }
};

/* ----------------------------------------------------------
   EMAIL VERIFICATION (using db instead of Supabase)
----------------------------------------------------------- */
export const sendVerificationEmail = async (email: string, verifyLink: string): Promise<{ error?: string }> => {
  try {
    const token = Math.random().toString(36).substring(2, 15);
    const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await query(
      `INSERT INTO email_verifications (email, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET token = $2, expires_at = $3`,
      [email, token, expiry]
    );

    const link = `${verifyLink}/verify-email?token=${token}`;

    await transporter.sendMail({
      from: `"${BRAND_NAME}" <${EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email Address",
      html: generateEmailTemplate(
        "Verify Your Email",
        "Thanks for joining! Please verify your email by clicking the button below.",
        link,
        "Verify Email"
      ),
    });

    console.log(`✅ Verification email sent to ${email}`);
    return {};
  } catch (err: any) {
    console.error("⚠️ Verification Email Error:", err);
    return { error: "Failed to send verification email." };
  }
};

/* ----------------------------------------------------------
   MASS EMAIL
----------------------------------------------------------- */
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

/* ----------------------------------------------------------
   TRIAL EMAILS
----------------------------------------------------------- */
export const sendTrialActivationEmail = async (
  email: string,
  trialEnd: Date
): Promise<{ error?: string }> => {
  try {
    const message = `
      Congratulations! 🎉 Your free trial is now active.
      Enjoy listing one car for 7 days on ${BRAND_NAME}.
      Your trial will end on <b>${trialEnd.toDateString()}</b>.
    `;

    await transporter.sendMail({
      from: `"${BRAND_NAME} Team" <${EMAIL_USER}>`,
      to: email,
      subject: "🎉 Free Trial Activated — Start Listing!",
      html: generateEmailTemplate(
        "Free Trial Activated 🎉",
        message,
        `${FRONTEND_URL}/dashboard`,
        "Go To Dashboard"
      ),
    });

    console.log(`📧 Trial activation email sent to ${email}`);
    return {};
  } catch (err: any) {
    console.error("⚠️ Trial Email Error:", err);
    return { error: "Failed to send trial activation email." };
  }
};

export const sendTrialReminderEmail = async (
  email: string,
  trialEnd: Date
): Promise<{ error?: string }> => {
  try {
    const message = `
      Hey! 👋 Your free trial with ${BRAND_NAME} is almost ending.
      It expires on <b>${trialEnd.toDateString()}</b>.
      Upgrade now to avoid losing access to car listing features.
    `;

    await transporter.sendMail({
      from: `"${BRAND_NAME} Billing" <${EMAIL_USER}>`,
      to: email,
      subject: "⏳ Your Free Trial Ends Soon — Don’t Miss Out!",
      html: generateEmailTemplate(
        "Trial Ending Soon ⏳",
        message,
        `${FRONTEND_URL}/pricing`,
        "Upgrade Now"
      ),
    });

    console.log(`📧 Trial reminder email sent to ${email}`);
    return {};
  } catch (err: any) {
    console.error("⚠️ Trial Reminder Error:", err);
    return { error: "Failed to send trial reminder email." };
  }
};
