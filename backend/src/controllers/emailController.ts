import { query } from "../db";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

/* ----------------------------------------------------------
   ENVIRONMENT VARIABLES
----------------------------------------------------------- */
const FRONTEND_URL = process.env.FRONTEND_URL;
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASS = process.env.EMAIL_PASS;
const BRAND_LOGO = process.env.BRAND_LOGO;
const BRAND_NAME = process.env.BRAND_NAME || "CarDirectory";
const BRAND_COLOR = "#533737ff";

/* ----------------------------------------------------------
   LOG ENV STATUS
----------------------------------------------------------- */
console.log("Email User:", EMAIL_USER ? "✅ Loaded" : "❌ Missing");
console.log("Email Pass:", EMAIL_PASS ? "✅ Loaded" : "❌ Missing");

/* ----------------------------------------------------------
   ZOHO SMTP TRANSPORTER
----------------------------------------------------------- */
const transporter = nodemailer.createTransport({
  host: "smtp.zoho.com",
  port: 465,
  secure: true,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS,
  },
});

/* ----------------------------------------------------------
   CUSTOM EMAIL TEMPLATE (Dark/Light Mode Support)
----------------------------------------------------------- */
const generateEmailTemplate = (
  title: string,
  message: string,
  buttonUrl?: string,
  buttonText?: string
): string => `
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>${title}</title>

<style>
  :root { color-scheme: light dark; }

  body {
    margin: 0;
    padding: 0;
    background-color: #f6f9fc;
    font-family: Arial, sans-serif;
    color: #333;
  }

  @media (prefers-color-scheme: dark) {
    body { background-color: #111; color: #eee; }
    .container { background-color: #1c1c1c !important; }
    .footer { background-color: #181818; color: #aaa; }
  }

  .container {
    max-width: 600px;
    margin: 30px auto;
    background: #fff;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0,0,0,0.12);
  }

  .header {
    background-color: ${BRAND_COLOR};
    padding: 25px;
    text-align: center;
  }

  .header img {
    width: 140px;
    filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
  }

  .body {
    padding: 32px;
  }

  .body h2 {
    margin-top: 0;
    color: ${BRAND_COLOR};
    font-size: 24px;
  }

  .body p {
    font-size: 16px;
    line-height: 1.6;
  }

  .btn {
    display: inline-block;
    margin-top: 20px;
    padding: 14px 28px;
    background: ${BRAND_COLOR};
    color: #fff !important;
    text-decoration: none;
    border-radius: 8px;
    font-size: 15px;
    font-weight: bold;
  }

  .footer {
    text-align: center;
    padding: 18px;
    font-size: 12px;
    background: #f0f0f0;
    color: #777;
  }

  .social-icons img {
    width: 26px;
    margin: 0 8px;
  }
</style>
</head>

<body>
<div class="container">

  <div class="header">
    <img src="${BRAND_LOGO}" alt="${BRAND_NAME}"/>
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
      <a href="https://www.facebook.com/profile.php?id=61582717470790"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png"/></a>
      <a href="https://x.com/cardirectory1?t=D5VKSzwZdroYZcZ77sdaUg&s=09"><img src="https://cdn-icons-png.flaticon.com/512/733/733579.png"/></a>
      <a href="https://www.instagram.com/car.directory"><img src="https://cdn-icons-png.flaticon.com/512/733/733561.png"/></a>
    </div>

    <p>© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
  </div>

</div>
</body>
</html>
`;

/* ----------------------------------------------------------
   PASSWORD RESET EMAIL
----------------------------------------------------------- */
export const sendPasswordResetEmail = async (email: string) => {
  try {
    const token = Math.random().toString(36).substring(2, 15);
    const expiry = new Date(Date.now() + 1000 * 60 * 15);

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
        "We received a request to reset your password. Click the button below to continue:",
        resetLink,
        "Reset Password"
      ),
    });

    console.log(`📧 Password reset email sent to: ${email}`);
    return {};
  } catch (err: any) {
    console.error("⚠️ Password Reset Error:", err);
    return { error: "Failed to send password reset email." };
  }
};

/* ----------------------------------------------------------
   EMAIL VERIFICATION EMAIL
----------------------------------------------------------- */
export const sendVerificationEmail = async (email: string, verifyLink: string) => {
  try {
    await transporter.sendMail({
      from: `"${BRAND_NAME}" <${EMAIL_USER}>`,
      to: email,
      subject: "Verify Your Email Address",
      html: generateEmailTemplate(
        "Verify Your Email",
        "Thanks for joining! Click the button below to verify your email.",
        verifyLink,
        "Verify Email"
      ),
    });

    console.log(`✅ Verification email sent to: ${email}`);
    return {};
  } catch (err: any) {
    console.error("⚠️ Verification Email Error:", err);
    return { error: "Failed to send verification email." };
  }
};

/* ----------------------------------------------------------
   MASS EMAIL
----------------------------------------------------------- */
export const sendMassEmail = async (recipients: string[], subject: string, message: string) => {
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
    console.error("⚠️ Mass Email Error:", err);
    return { success: false };
  }
};

/* ----------------------------------------------------------
   TRIAL ACTIVATION EMAIL
----------------------------------------------------------- */
export const sendTrialActivationEmail = async (email: string, trialEnd: Date) => {
  try {
    const message = `
      🎉 Congratulations! Your free trial is now active.<br/>
      You can now list one car for 7 days on ${BRAND_NAME}.<br/>
      Your trial ends on <b>${trialEnd.toDateString()}</b>.
    `;

    await transporter.sendMail({
      from: `"${BRAND_NAME} Team" <${EMAIL_USER}>`,
      to: email,
      subject: "🎉 Your Free Trial Is Active!",
      html: generateEmailTemplate(
        "Free Trial Activated",
        message,
        `${FRONTEND_URL}/dashboard`,
        "Go to Dashboard"
      ),
    });

    console.log(`📧 Trial activation email sent to: ${email}`);
    return {};
  } catch (err: any) {
    console.error("⚠️ Trial Activation Error:", err);
    return { error: "Failed to send trial activation email." };
  }
};

/* ----------------------------------------------------------
   TRIAL END REMINDER EMAIL
----------------------------------------------------------- */
export const sendTrialReminderEmail = async (email: string, trialEnd: Date) => {
  try {
    const message = `
      ⏳ Hey! Your free trial with ${BRAND_NAME} is ending soon.<br/>
      It expires on <b>${trialEnd.toDateString()}</b>.<br/>
      Upgrade now to avoid losing access.
    `;

    await transporter.sendMail({
      from: `"${BRAND_NAME} Billing" <${EMAIL_USER}>`,
      to: email,
      subject: "⏳ Your Free Trial Ends Soon",
      html: generateEmailTemplate(
        "Your Trial Ends Soon",
        message,
        `${FRONTEND_URL}/pricing`,
        "Upgrade Now"
      ),
    });

    console.log(`📧 Trial reminder email sent to: ${email}`);
    return {};
  } catch (err: any) {
    console.error("⚠️ Trial Reminder Error:", err);
    return { error: "Failed to send trial reminder email." };
  }
};
