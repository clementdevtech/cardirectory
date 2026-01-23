import axios from "axios";
import { query } from "../db";
import dotenv from "dotenv";
dotenv.config();

/* ENV */
const FRONTEND_URL = process.env.FRONTEND_URL;
const BRAND_LOGO = process.env.BRAND_LOGO;
const BRAND_NAME = process.env.BRAND_NAME || "CarDirectory";
const BRAND_COLOR = "#533737ff";

const {
  ZOHO_CLIENT_ID,
  ZOHO_CLIENT_SECRET,
  ZOHO_REFRESH_TOKEN,
  ZOHO_FROM,
  ZOHO_ACCOUNTS_HOST,
  ZOHO_MAIL_HOST,
} = process.env;

/* ------------------------------------------------------------
   Zoho Endpoints
------------------------------------------------------------- */
const ZOHO_AUTH_URL = `${ZOHO_ACCOUNTS_HOST}/oauth/v2/token`;

// Cache
let cachedToken: string | null = null;
let cachedAccountId: string | null = null;

/* ------------------------------------------------------------
   Safe JSON for axios
------------------------------------------------------------- */
const safeJson = (data: any) => {
  try {
    return typeof data === "string" ? JSON.parse(data) : data;
  } catch {
    return { raw: data };
  }
};

/* ------------------------------------------------------------
   GET ACCESS TOKEN
------------------------------------------------------------- */
const getZohoAccessToken = async (): Promise<string> => {
  //console.log("Fetching Zoho access token...");
  if (cachedToken) return cachedToken;

  try {
    const params = new URLSearchParams({
      refresh_token: ZOHO_REFRESH_TOKEN!,
      client_id: ZOHO_CLIENT_ID!,
      client_secret: ZOHO_CLIENT_SECRET!,
      grant_type: "refresh_token",
    });

    const res = await axios.post(ZOHO_AUTH_URL, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });

    if (!res.data.access_token) {
      throw new Error("❌ Missing access_token: " + JSON.stringify(res.data));
    }
    
    cachedToken = res.data.access_token;
    //console.log("✅ Zoho access token fetched.");
    return cachedToken;
  } catch (err: any) {
    console.error("❌ Failed to refresh token:", safeJson(err.response?.data || err));
    throw err;
  }
};

/* ------------------------------------------------------------
   GET ACCOUNT ID
------------------------------------------------------------- */
const getZohoAccountId = async (token: string): Promise<string> => {
  //console.log("Fetching Zoho accountId...");
  if (cachedAccountId) return cachedAccountId;

  try {
    const res = await axios.get(`${ZOHO_MAIL_HOST}/api/accounts`, {
      headers: { Authorization: `Zoho-oauthtoken ${token}` },
    });

    const accountId = res.data?.data?.[0]?.accountId;
    if (!accountId) throw new Error("No Zoho accountId found.");

    cachedAccountId = String(accountId);
    //console.log("✅ Zoho accountId fetched:", cachedAccountId);
    return cachedAccountId;
  } catch (err: any) {
    console.error("❌ Failed to fetch Zoho accountId:", safeJson(err.response?.data || err));
    throw err;
  }
};

/* ------------------------------------------------------------
   SEND EMAIL
------------------------------------------------------------- */
export const sendZohoMail = async (
  to: string,
  subject: string,
  html: string
): Promise<boolean> => {
  console.log("Sending Zoho email...");
  try {
    const accessToken = await getZohoAccessToken();
    const accountId = await getZohoAccountId(accessToken);

    const payload = {
      fromAddress: ZOHO_FROM,
      toAddress: to,
      subject,
      content: html,
      mailFormat: "html",
    };

    await axios.post(
      `${ZOHO_MAIL_HOST}/api/accounts/${accountId}/messages`,
      payload,
      { headers: { Authorization: `Zoho-oauthtoken ${accessToken}` } }
    );

    return true;
  } catch (err: any) {
    // Handle 401 token expired → retry once
    if (err.response?.status === 401) {
      cachedToken = null;
      const newToken = await getZohoAccessToken();
      return sendZohoMail(to, subject, html);
    }

    console.error("❌ Zoho Email Error:", safeJson(err.response?.data || err));
    return false;
  }
};

/* ------------------------------------------------------------
   EMAIL TEMPLATE
------------------------------------------------------------- */
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

  .body h2 { color: ${BRAND_COLOR}; }

  .btn {
    display: inline-block;
    margin-top: 20px;
    padding: 14px 28px;
    background: ${BRAND_COLOR};
    color: #fff !important;
    text-decoration: none;
    border-radius: 8px;
    font-weight: bold;
  }

  .footer {
    text-align: center;
    padding: 18px;
    font-size: 12px;
    background: #f0f0f0;
    color: #777;
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
    <p>© ${new Date().getFullYear()} ${BRAND_NAME}. All rights reserved.</p>
  </div>

</div>
</body>
</html>
`;

/* ------------------------------------------------------------
   PASSWORD RESET
------------------------------------------------------------- */
export const sendPasswordResetEmail = async (email: string) => {
  try {
    const token = Math.random().toString(36).substring(2, 15);
    const expiry = new Date(Date.now() + 1000 * 60 * 15);

    await query(
      `INSERT INTO password_resets (email, token, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET token=$2, expires_at=$3`,
      [email, token, expiry]
    );

    const resetLink = `${FRONTEND_URL}/reset-password?token=${token}`;

    const html = generateEmailTemplate(
      "Password Reset Request",
      "We received a request to reset your password.",
      resetLink,
      "Reset Password"
    );

    await sendZohoMail(email, "Password Reset Request", html);

    return {};
  } catch (err) {
    return { error: "Failed to send password reset email." };
  }
};

/* ------------------------------------------------------------
   VERIFY EMAIL
------------------------------------------------------------- */
export const sendVerificationEmail = async (
  email: string,
  verifyLink: string
) => {
  try {
    const html = generateEmailTemplate(
      "Verify Your Email",
      "Thanks for joining! Click the button below to verify your email.",
      verifyLink,
      "Verify Email"
    );

    await sendZohoMail(email, "Verify Your Email", html);
    return {};
  } catch (err) {
    return { error: "Failed to send verification email." };
  }
};

/* ------------------------------------------------------------
   MASS EMAIL
------------------------------------------------------------- */
export const sendMassEmail = async (
  recipients: string[],
  subject: string,
  message: string
) => {
  const html = generateEmailTemplate(subject, message);

  const results = await Promise.allSettled(
    recipients.map((email) => sendZohoMail(email, subject, html))
  );

  const failed = results
    .map((r, i) => (r.status === "rejected" ? recipients[i] : null))
    .filter(Boolean) as string[];

  return { success: failed.length === 0, failed };
};

/* ------------------------------------------------------------
   TRIAL ACTIVATION
------------------------------------------------------------- */
export const sendTrialActivationEmail = async (
  email: string,
  trialEnd: Date
) => {
  try {
    const message = `
      🎉 Your free trial is now active!<br/>
      Ends on <b>${trialEnd.toDateString()}</b>.
    `;

    const html = generateEmailTemplate(
      "Your Trial Is Active",
      message,
      `${FRONTEND_URL}/dashboard`,
      "Go to Dashboard"
    );

    await sendZohoMail(email, "🎉 Your Trial Is Active!", html);
    return {};
  } catch (err) {
    return { error: "Failed to send trial activation email." };
  }
};

/* ------------------------------------------------------------
   TRIAL REMINDER
------------------------------------------------------------- */
export const sendTrialReminderEmail = async (
  email: string,
  trialEnd: Date
) => {
  try {
    const message = `
      ⏳ Your trial ends on <b>${trialEnd.toDateString()}</b>.<br/>
      Upgrade to keep your listing active.
    `;

    const html = generateEmailTemplate(
      "Your Trial Ends Soon",
      message,
      `${FRONTEND_URL}/pricing`,
      "Upgrade Now"
    );

    await sendZohoMail(email, "⏳ Your Trial Ends Soon", html);
    return {};
  } catch (err) {
    return { error: "Failed to send trial reminder email." };
  }
};
