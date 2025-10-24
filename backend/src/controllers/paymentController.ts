import { Request, Response } from "express";
import fetch from "node-fetch";
import { supabase } from "../supabaseClient";
import { query } from "../db";
import { sendMassEmail, sendTrialActivationEmail, sendTrialReminderEmail  } from "./emailController";
import { DateTime } from "luxon";
import cron from "node-cron";

// ✅ Environment Setup
const CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY!;
const CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET!;
const PESAPAL_NOTIFICATION_ID = process.env.PESAPAL_NOTIFICATION_ID;
const FRONTEND_URL = process.env.FRONTEND_URL;
const PESAPAL_IPN_URL = process.env.PESAPAL_IPN_URL!;

const ENV = process.env.PESAPAL_ENVIRONMENT === "production" ? "live" : "sandbox";
const BASE_URL =
  ENV === "sandbox"
    ? "https://cybqa.pesapal.com/pesapalv3"
    : "https://pay.pesapal.com/v3";

console.log("🔑 Pesapal Environment:", ENV);
console.log("🔔 Notification ID:", PESAPAL_NOTIFICATION_ID);

// ✅ Token cache (avoid repeated requests)
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

/**
 * STEP 1 — Get Pesapal Access Token (OAuth2)
 */
async function getPesapalToken(): Promise<string> {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) return cachedToken;

  const resp = await fetch(`${BASE_URL}/api/Auth/RequestToken`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      consumer_key: CONSUMER_KEY,
      consumer_secret: CONSUMER_SECRET,
    }),
  });

  const data = await resp.json();
  if (!resp.ok || !data.token) {
    console.error("❌ Failed to obtain Pesapal token:", data);
    throw new Error("Could not obtain Pesapal token");
  }

  cachedToken = data.token;
  tokenExpiry = Date.now() + 55 * 60 * 1000; // ~55 minutes
  return data.token;
}

/**
 * STEP 2 — Create Pesapal Order
 */
export const createPesaPalOrder = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { user_id, plan, amount, phone } = req.body;

    if (!user_id || !plan || !amount || !phone) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // ✅ Generate unique order reference
    const merchant_reference = `ORDER-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const callback_url = PESAPAL_IPN_URL;

    // ✅ Insert pending payment into PostgreSQL
    await query(
      `INSERT INTO payments (user_id, plan_name, amount, method, phone, status, merchant_reference)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user_id, plan, amount, "pesapal", phone, "pending", merchant_reference]
    );

    // ✅ Get Pesapal auth token
    const token = await getPesapalToken();

    // ✅ Dynamic redirect URL for this order
    const PESAPAL_REDIRECT_URL = `${FRONTEND_URL}/payment-status?ref=${merchant_reference}`;

    // ✅ Create Pesapal order payload
    const order = {
      id: merchant_reference,
      currency: "KES",
      amount,
      description: `CarDirectory ${plan} Plan Subscription`,
      callback_url,
      redirect_url: PESAPAL_REDIRECT_URL,
      notification_id: PESAPAL_NOTIFICATION_ID,
      billing_address: {
        phone_number: phone,
        country_code: "KE",
        first_name: "User",
        last_name: "Subscriber",
        email_address: "",
        city: "Nairobi",
      },
    };

    // ✅ Submit order to Pesapal API
    const resp = await fetch(`${BASE_URL}/api/Transactions/SubmitOrderRequest`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(order),
    });

    const data = await resp.json();

    if (!resp.ok || !data.redirect_url) {
      console.error("❌ Pesapal order error:", data);
      throw new Error(data.error || "Failed to create Pesapal order");
    }

    // ✅ Success — return payment link & reference
    return res.status(200).json({
      success: true,
      payment_link: data.redirect_url,
      merchant_reference,
    });

  } catch (err: any) {
    console.error("❌ createPesaPalOrder error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * STEP 3 — Handle Pesapal IPN (Webhook)
 * For ipn_notification_type = GET
 */
export const handlePesapalIPN = async (req: Request, res: Response): Promise<Response> => {
  try {
    console.log("📬 Incoming Pesapal GET IPN:", req.query);

    const { OrderMerchantReference, OrderTrackingId } = req.query;

    if (!OrderMerchantReference || !OrderTrackingId) {
      return res.status(400).json({ error: "Missing query parameters" });
    }

    // ✅ Step 1: Get access token
    const token = await getPesapalToken();

    // ✅ Step 2: Fetch transaction status
    const statusResp = await fetch(
      `${BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${OrderTrackingId}`,
      {
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    const statusData = await statusResp.json();
    console.log("🔍 Transaction status:", statusData);

    const paymentStatus = (statusData.payment_status_description || statusData.status || "").toUpperCase();
    const merchant_reference = OrderMerchantReference as string;

    // ✅ Step 3: Fetch payment details
    const paymentResult = await query(
      `SELECT user_id, plan_name, amount, status FROM payments WHERE merchant_reference = $1 LIMIT 1`,
      [merchant_reference]
    );

    if (paymentResult.rowCount === 0) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const payment = paymentResult.rows[0];

    // ✅ Step 4: Get user info
    const userResult = await query(
      `SELECT email, full_name FROM users WHERE id = $1 LIMIT 1`,
      [payment.user_id]
    );
    const user = userResult.rows[0];

    // ✅ Step 5: Define payment states
    const successStates = ["COMPLETED", "SUCCESS", "PAID"];
    const failedStates = ["FAILED", "CANCELLED", "REVERSED", "INVALID"];

    if (successStates.includes(paymentStatus)) {
      if (payment.status !== "success") {
        // ✅ Mark payment as successful
        await query(
          `UPDATE payments SET status = 'success' WHERE merchant_reference = $1`,
          [merchant_reference]
        );

        // ✅ Calculate subscription end date
        const startDate = new Date();
        const endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + 30);

        // ✅ Create or update subscription
        await query(
          `INSERT INTO subscriptions (user_id, plan_name, price, listings_allowed, listings_used, start_date, end_date, status)
           VALUES ($1, $2, $3, 50, 0, $4, $5, 'active')
           ON CONFLICT (user_id) DO UPDATE 
           SET plan_name = EXCLUDED.plan_name,
               price = EXCLUDED.price,
               listings_allowed = EXCLUDED.listings_allowed,
               listings_used = 0,
               start_date = EXCLUDED.start_date,
               end_date = EXCLUDED.end_date,
               status = 'active'`,
          [payment.user_id, payment.plan_name, payment.amount, startDate.toISOString(), endDate.toISOString()]
        );

        // ✅ Update user role
        await query(`UPDATE users SET role = 'dealer' WHERE id = $1`, [payment.user_id]);

        // ✅ Upsert user_roles
        await query(
          `INSERT INTO user_roles (user_id, role)
           VALUES ($1, 'dealer')
           ON CONFLICT (user_id) DO UPDATE SET role = 'dealer'`,
          [payment.user_id]
        );

        console.log(`✅ User ${payment.user_id} upgraded to dealer.`);

        // ✅ Send Success Email
        if (user?.email) {
          await sendMassEmail(
            [user.email],
            "Payment Successful",
            `Hi ${user.full_name || "there"},<br/><br/>
            Your payment of <b>KES ${payment.amount}</b> for the <b>${payment.plan_name}</b> plan was successful.<br/>
            Your dealer account has been activated and is valid for 30 days.<br/><br/>
            <a href="${FRONTEND_URL}/dashboard" class="btn">Go to Dashboard</a>`
          );
        }
      }
    } else if (failedStates.includes(paymentStatus)) {
      // ✅ Mark payment as failed
      await query(
        `UPDATE payments SET status = 'failed' WHERE merchant_reference = $1`,
        [merchant_reference]
      );

      console.log(`❌ Payment ${merchant_reference} marked as failed.`);

      // ✅ Send Failure Email
      if (user?.email) {
        await sendMassEmail(
          [user.email],
          "Payment Failed or Cancelled",
          `Hi ${user.full_name || "there"},<br/><br/>
          Unfortunately, your payment for the <b>${payment.plan_name}</b> plan was not successful.<br/>
          If this was a mistake, please try again.<br/><br/>
          <a href="${FRONTEND_URL}/pricing" class="btn">Retry Payment</a>`
        );
      }
    }

    // ✅ Step 6: Acknowledge Pesapal IPN
    return res.status(200).json({ received: true });

  } catch (err: any) {
    console.error("❌ Pesapal IPN Error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/**
 * STEP 4 — Get Payment Status (Called from frontend /payment-status page)
 */
export const paymentstatus = async (req: Request, res: Response): Promise<Response> => {
  console.log("🔎 Checking payment status...");
  try {
    const { merchant_reference } = req.params;

    if (!merchant_reference) {
      return res.status(400).json({ success: false, error: "Missing merchant_reference" });
    }

    // ✅ Get payment record from PostgreSQL
    const result = await query(
      `SELECT * FROM payments WHERE merchant_reference = $1 LIMIT 1`,
      [merchant_reference]
    );
    const payment = result.rows[0];

    if (!payment) {
      console.log("❌ Payment not found");
      return res.status(404).json({ success: false, error: "Payment not found" });
    }

    // ✅ Get Pesapal token
    const token = await getPesapalToken();

    // ✅ Use tracking_id if exists, else merchant_reference
    const trackingId = payment.tracking_id || payment.merchant_reference;

    const response = await fetch(
      `${BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${trackingId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) {
      const errBody = await response.text();
      console.error("❌ Pesapal Status Fetch Error:", errBody);
      return res.status(502).json({ success: false, error: "Failed to get transaction status from Pesapal" });
    }

    const statusData = await response.json();
    const paymentStatus = statusData.payment_status_description?.toUpperCase() || "FAILED";

    // ✅ Normalize status for frontend
    let frontendStatus: "success" | "pending" | "cancelled" | "failed" = "failed";
    if (["COMPLETED", "SUCCESS", "PAID"].includes(paymentStatus)) frontendStatus = "success";
    else if (["PENDING", "PROCESSING"].includes(paymentStatus)) frontendStatus = "pending";
    else if (["CANCELLED", "FAILED", "REVERSED"].includes(paymentStatus)) frontendStatus = "cancelled";

    // ✅ Update DB if status changed
    if (frontendStatus !== payment.status) {
      await query(
        `UPDATE payments SET status = $1 WHERE merchant_reference = $2`,
        [frontendStatus, merchant_reference]
      );
    }

    return res.status(200).json({
      success: true,
      merchant_reference,
      status: frontendStatus,
      pesapal_status: paymentStatus,
    });
  } catch (err: any) {
    console.error("❌ Pesapal status check error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};


/**
 * 
 * STEP 6 — Register IPN (Run once to get notification_id)
 */


export const activateFreeTrial = async (req: Request, res: Response) => {
  console.log("📌 Trial Activation Endpoint Hit");

  try {
    const { user_id, email, full_name, phone, country } = req.body;

    if (!user_id || !email) {
      return res.status(400).json({
        success: false,
        error: "Missing user details",
      });
    }

    // 1️⃣ Fetch user data
    const { rows: users } = await query(
      `SELECT id, role, trial_end, trial_used, full_name, email FROM users WHERE id = $1`,
      [user_id]
    );
    const existing = users[0];

    if (!existing)
      return res.status(404).json({ success: false, error: "User not found" });

    const now = new Date();
    const trialEnd = existing.trial_end ? new Date(existing.trial_end) : null;

    // 2️⃣ Prevent reactivation if already used once
    if (existing.trial_used) {
      return res.status(403).json({
        success: false,
        error: "Free trial has already been used and cannot be reactivated.",
      });
    }

    // 3️⃣ Prevent duplicate activation if trial still active
    if (trialEnd && trialEnd > now) {
      return res.json({
        success: true,
        message: "Active trial already exists",
        alreadyHasTrial: true,
      });
    }

    // 4️⃣ Skip for admins
    if (existing.role === "admin") {
      return res.json({
        success: true,
        message: "Admins do not require a free trial.",
        role: existing.role,
      });
    }

    // 5️⃣ Create 7-day trial
    const trialStart = now;
    const newTrialEnd = new Date(now);
    newTrialEnd.setDate(now.getDate() + 7);

    // 6️⃣ Update user info and mark as used
    await query(
      `
      UPDATE users
      SET 
        role = 'dealer',
        trial_start = $1,
        trial_end = $2,
        trial_used = true,
        updated_at = NOW()
      WHERE id = $3
    `,
      [trialStart.toISOString(), newTrialEnd.toISOString(), user_id]
    );

    // 7️⃣ Ensure dealer profile exists
    const { rows: dealerCheck } = await query(
      `SELECT id FROM dealers WHERE user_id = $1`,
      [user_id]
    );

    if (dealerCheck.length === 0) {
      await query(
        `
        INSERT INTO dealers (user_id, full_name, email, phone, country, status, created_at)
        VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
      `,
        [
          user_id,
          existing.full_name || full_name || "Unnamed Dealer",
          existing.email || email,
          phone || null,
          country || null,
        ]
      );
    }

    // 8️⃣ Send activation email
    await sendTrialActivationEmail(email, newTrialEnd);

    console.log("✅ Trial activated for:", email);

    return res.json({
      success: true,
      message: "Free trial activated successfully.",
      role: "dealer",
      trial_start: trialStart,
      trial_end: newTrialEnd,
    });
  } catch (err: any) {
    console.error("❌ Free Trial Error:", err);
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};



export const submitAfterPayment = async (req: Request, res: Response) => {
  try {
    const { user_id, make, model, year, price, mileage, location, description, condition, transmission, phone, galleryFiles, hasVideo, plan } = req.body;

    if (!user_id) return res.status(400).json({ success: false, error: "Missing user_id" });

    const dealer = await supabase.from("dealers").select("id").eq("user_id", user_id).maybeSingle();

    if (!dealer.data)
      return res.status(400).json({ success: false, error: "Dealer not found" });

    // ✅ Upload handling could be extended later
    const { error } = await supabase.from("cars").insert([
      {
        make,
        model,
        year,
        price,
        mileage,
        location,
        description,
        condition,
        transmission,
        phone,
        gallery: galleryFiles || [],
        featured: plan === "premium",
        status: "active", // automatically approved after payment
        dealer_id: dealer.data.id,
      },
    ]);

    if (error) throw error;

    return res.json({ success: true });
  } catch (err: any) {
    console.error("❌ submitAfterPayment error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
};


/**
 * 
 * STEP 6 — Register IPN (Run once to get notification_id)
 */
export const registerPesapalIPN = async (req: Request, res: Response) => {
  try {
    const token = await getPesapalToken();

    const payload = {
      url: process.env.PESAPAL_IPN_URL, // must be live HTTPS
      ipn_notification_type: "GET",
    };

    const response = await fetch(`${BASE_URL}/api/URLSetup/RegisterIPN`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("❌ IPN registration failed:", data);
      return res.status(400).json({ success: false, error: data });
    }

    console.log("✅ IPN Registered:", data);
    return res.status(200).json({ success: true, data });
  } catch (err) {
    console.error("❌ registerPesapalIPN error:", err);
    return res.status(500).json({ success: false, error: (err as Error).message });
  }
};

export const trialReminderJob = async () => {
  try {
    const now = DateTime.now();
    const tomorrow = now.plus({ days: 1 }).toISODate();

    // ✅ 1. Find users whose trial ends TOMORROW (for reminder)
    const usersResult = await query(
      `SELECT id, email, trial_end, trial_reminder_sent, role 
       FROM users 
       WHERE role = $1 
       AND trial_reminder_sent = false 
       AND trial_end::date = $2`,
      ["dealer", tomorrow]
    );

    const users = usersResult.rows;

    if (users.length > 0) {
      console.log(`📌 Found ${users.length} trial users to notify...`);

      for (const user of users) {
        const trialEnd = DateTime.fromISO(user.trial_end);
        const emailRes = await sendTrialReminderEmail(user.email, trialEnd.toJSDate());

        if (!emailRes.error) {
          // ✅ Mark reminder as sent
          await query(
            `UPDATE users SET trial_reminder_sent = true WHERE id = $1`,
            [user.id]
          );
          console.log(`📨 Reminder sent to ${user.email}`);
        } else {
          console.error(`❌ Failed to send reminder to ${user.email}:`, emailRes.error);
        }
      }

      console.log("✅ Trial reminder emails sent successfully!");
    } else {
      console.log("✅ No users need a trial reminder today");
    }

    // ✅ 2. Handle expired trials (trial_end < now)
    const expiredUsersResult = await query(
      `SELECT id, email, role, trial_end 
       FROM users 
       WHERE trial_end < $1 
       AND role != 'admin'`,
      [now.toISO()]
    );

    const expiredUsers = expiredUsersResult.rows;

    if (expiredUsers.length > 0) {
      console.log(`⚠️ Found ${expiredUsers.length} expired trial users...`);

      for (const user of expiredUsers) {
        // ✅ Update their account to revert from trial
        await query(
          `UPDATE users 
           SET role = 'user', 
               trial_end = NULL, 
               trial_reminder_sent = true, 
               has_used_trial = true 
           WHERE id = $1`,
          [user.id]
        );

        console.log(`🔻 User ${user.email} trial expired and reverted to 'user'.`);
      }

      console.log("✅ Expired trials handled successfully!");
    } else {
      console.log("✅ No expired trials found today");
    }
  } catch (err: any) {
    console.error("⚠️ Trial reminder job error:", err.message);
  }
};

// ✅ Run every day at midnight UTC
cron.schedule("0 0 * * *", trialReminderJob);