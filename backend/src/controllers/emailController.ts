import { query } from "../db";
import nodemailer, { Transporter } from "nodemailer";
import { Resend } from "resend";
import dotenv from "dotenv";

dotenv.config();

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const BRAND_LOGO = process.env.BRAND_LOGO;
const BRAND_NAME = process.env.BRAND_NAME || "CarDirectory";
const BRAND_COLOR = "#533737ff";

console.log("Email User:", EMAIL_USER ? "✅ Loaded" : "❌ Missing");
console.log("Email Pass:", EMAIL_PASS ? "✅ Loaded" : "❌ Missing");
console.log("Resend Key:", RESEND_API_KEY ? "✅ Loaded" : "❌ Missing");

let transporter: Transporter | null = null;
if (!RESEND_API_KEY && EMAIL_USER && EMAIL_PASS) {
  // Nodemailer fallback (for local / dev). We still prefer Resend when available.
  transporter = nodemailer.createTransport({
    host: "smtp.zoho.com",
    port: 587,
    secure: false,
    requireTLS: true,
    tls: {
      rejectUnauthorized: false,
      // some environments need relaxed TLS; adjust as needed
    },
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    connectionTimeout: 20000,
  });

  // attempt verify and fallback to 465 if verify fails
  transporter.verify((err, success) => {
    if (err) {
      console.warn("⚠️ Nodemailer verify failed for 587, attempting 465 fallback:", err.message);
      transporter = nodemailer.createTransport({
        host: "smtp.zoho.com",
        port: 465,
        secure: true,
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS,
        },
        connectionTimeout: 20000,
      });
      transporter.verify((err2) => {
        if (err2) {
          console.error("❌ Nodemailer verify also failed on 465:", err2.message);
        } else {
          console.log("✅ Nodemailer connected using port 465 (SSL).");
        }
      });
    } else {
      console.log("✅ Nodemailer connected using port 587 (STARTTLS).");
    }
  });
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

/* ------------------------
   HTML Template Generator
   ------------------------ */
const generateEmailTemplate = (
  title: string,
  message: string,
  buttonUrl?: string,
  buttonText?: string
): string => `<!DOCTYPE html>
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
      <img src="${BRAND_LOGO || ""}" alt="${BRAND_NAME}" />
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
        <a href="https://x.com/cardirectory1" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/733/733579.png" alt="Twitter"/></a>
        <a href="https://www.instagram.com/car.directory" target="_blank"><img src="https://cdn-icons-png.flaticon.com/512/733/733561.png" alt="LinkedIn"/></a>
      </div>
      <p>&copy; ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
    </div>
  </div>
</body>
</html>`;

/* ------------------------
   Utility: send via provider
   - Resend preferred (API)
   - Otherwise Nodemailer used (if configured)
   - All sends are non-blocking for route handlers
   ------------------------ */
const sendEmailViaProvider = async (opts: {
  to: string;
  subject: string;
  html: string;
  from?: string;
}): Promise<void> => {
  const fromAddress = opts.from || EMAIL_USER || `noreply@${process.env.DOMAIN || "localhost"}`;

  if (resend) {
    // Resend API
    try {
      await resend.emails.send({
        from: `${BRAND_NAME} <${fromAddress}>`,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });
      console.log(`📧 (Resend) Email queued to ${opts.to}`);
      return;
    } catch (err: any) {
      console.error("⚠️ Resend send failed:", err?.message ?? err);
      // fallback to nodemailer if available
    }
  }

  if (transporter) {
    transporter
      .sendMail({
        from: fromAddress,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      })
      .then(() => console.log(`📧 (SMTP) Email queued to ${opts.to}`))
      .catch((err: any) => console.error("⚠️ SMTP send failed:", err?.message ?? err));
    return;
  }

  console.warn("⚠️ No email provider configured (RESEND_API_KEY or EMAIL_USER/EMAIL_PASS required).");
};

/* ----------------------------------------------------------
   PASSWORD RESET EMAIL
   - Saves token to password_resets table
   - Sends email asynchronously (non-blocking)
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

    const resetLink = `${FRONTEND_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    // fire-and-forget
    sendEmailViaProvider({
      to: email,
      subject: "Password Reset Request",
      html: generateEmailTemplate(
        "Password Reset Request",
        "We received a request to reset your password. Please click below to proceed.",
        resetLink,
        "Reset Password"
      ),
      from: EMAIL_USER,
    }).catch((e) => console.error("sendPasswordResetEmail send error:", e));

    console.log(`📧 Password reset token stored & email queued to ${email}`);
    return {};
  } catch (err: any) {
    console.error("⚠️ Password Reset Error:", err);
    return { error: "Failed to send password reset email." };
  }
};

/* ----------------------------------------------------------
   EMAIL VERIFICATION (single-token DB flow)
   - Stores token in email_verifications table
   - Sends verification link non-blocking
----------------------------------------------------------- */
export const sendVerificationEmail = async (email: string): Promise<{ error?: string }> => {
  try {
    const token = Math.random().toString(36).substring(2, 18);
    const expiry = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await query(
      `INSERT INTO email_verifications (email, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET token = $2, expires_at = $3`,
      [email, token, expiry]
    );

    // Build a clean link: FRONTEND_URL/verify-email?token=...&email=...
    const link = `${FRONTEND_URL.replace(/\/$/, "")}/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;

    sendEmailViaProvider({
      to: email,
      subject: "Verify Your Email Address",
      html: generateEmailTemplate(
        "Verify Your Email",
        "Thanks for joining! Please verify your email by clicking the button below.",
        link,
        "Verify Email"
      ),
      from: EMAIL_USER,
    }).catch((e) => console.error("sendVerificationEmail send error:", e));

    console.log(`✅ Verification token stored & email queued for ${email}`);
    return {};
  } catch (err: any) {
    console.error("⚠️ Verification Email Error:", err);
    return { error: "Failed to send verification email." };
  }
};

/* ----------------------------------------------------------
   VERIFY TOKEN ROUTE HELPER
   - Use this in your verify endpoint
   ---------------------------------------------------------- */
export const verifyEmailToken = async (token: string, email: string): Promise<{ success: boolean; error?: string }> => {
  try {
    const result = await query(
      `SELECT token, expires_at FROM email_verifications WHERE email = $1 LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return { success: false, error: "Invalid or expired token" };
    }

    const record = result.rows[0];
    if (record.token !== token) {
      return { success: false, error: "Invalid token" };
    }

    if (new Date(record.expires_at) < new Date()) {
      return { success: false, error: "Token expired" };
    }

    // Mark user verified
    await query(`UPDATE users SET is_verified = true WHERE email = $1`, [email]);

    // Optionally remove token
    await query(`DELETE FROM email_verifications WHERE email = $1`, [email]).catch(() => {});

    return { success: true };
  } catch (err: any) {
    console.error("verifyEmailToken error:", err);
    return { success: false, error: "Server error" };
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
        sendEmailViaProvider({
          to: email,
          subject,
          html: generateEmailTemplate(subject, message),
          from: EMAIL_USER,
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

    sendEmailViaProvider({
      to: email,
      subject: "🎉 Free Trial Activated — Start Listing!",
      html: generateEmailTemplate("Free Trial Activated 🎉", message, `${FRONTEND_URL.replace(/\/$/, "")}/dashboard`, "Go To Dashboard"),
      from: EMAIL_USER,
    }).catch((e) => console.error("sendTrialActivationEmail send error:", e));

    console.log(`📧 Trial activation email queued for ${email}`);
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

    sendEmailViaProvider({
      to: email,
      subject: "⏳ Your Free Trial Ends Soon — Don’t Miss Out!",
      html: generateEmailTemplate("Trial Ending Soon ⏳", message, `${FRONTEND_URL.replace(/\/$/, "")}/pricing`, "Upgrade Now"),
      from: EMAIL_USER,
    }).catch((e) => console.error("sendTrialReminderEmail send error:", e));

    console.log(`📧 Trial reminder email queued for ${email}`);
    return {};
  } catch (err: any) {
    console.error("⚠️ Trial Reminder Error:", err);
    return { error: "Failed to send trial reminder email." };
  }
};
