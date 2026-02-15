const fetch = require("node-fetch");
const cron = require("node-cron");
const { DateTime } = require("luxon");

const { supabase } = require("../supabaseClient");
const { query } = require("../db");
const {
  sendMassEmail,
  sendTrialActivationEmail,
  sendTrialReminderEmail,
} = require("./emailController");

/* =====================================
   ENV SETUP
===================================== */
const CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY;
const CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET;
const PESAPAL_NOTIFICATION_ID = process.env.PESAPAL_NOTIFICATION_ID;
const FRONTEND_URL = process.env.FRONTEND_URL;
const PESAPAL_IPN_URL = process.env.PESAPAL_IPN_URL;

const ENV =
  process.env.PESAPAL_ENVIRONMENT === "production" ? "live" : "sandbox";

const BASE_URL =
  ENV === "sandbox"
    ? "https://cybqa.pesapal.com/pesapalv3"
    : "https://pay.pesapal.com/v3";

console.log("🔑 Pesapal Environment:", ENV);
console.log("🔔 Notification ID:", PESAPAL_NOTIFICATION_ID);

/* =====================================
   TOKEN CACHE
===================================== */
let cachedToken = null;
let tokenExpiry = null;

/* =====================================
   GET PESAPAL TOKEN
===================================== */
async function getPesapalToken() {
  if (cachedToken && tokenExpiry && Date.now() < tokenExpiry) {
    return cachedToken;
  }

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
  tokenExpiry = Date.now() + 55 * 60 * 1000;
  return data.token;
}

/* =====================================
   CREATE PESAPAL ORDER
===================================== */
exports.createPesaPalOrder = async (req, res) => {
  try {
    const { user_id, plan, amount, phone } = req.body;

    if (!user_id || !plan || !amount || !phone) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const merchant_reference = `ORDER-${Date.now()}-${Math.floor(
      Math.random() * 10000
    )}`;

    await query(
      `INSERT INTO payments
       (user_id, plan_name, amount, method, phone, status, merchant_reference)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [user_id, plan, amount, "pesapal", phone, "pending", merchant_reference]
    );

    const token = await getPesapalToken();

    const redirect_url = `${FRONTEND_URL}/payment-status?ref=${merchant_reference}`;

    const order = {
      id: merchant_reference,
      currency: "KES",
      amount,
      description: `CarDirectory ${plan} Plan Subscription`,
      callback_url: PESAPAL_IPN_URL,
      redirect_url,
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

    const resp = await fetch(
      `${BASE_URL}/api/Transactions/SubmitOrderRequest`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(order),
      }
    );

    const data = await resp.json();

    if (!resp.ok || !data.redirect_url) {
      console.error("❌ Pesapal order error:", data);
      throw new Error("Failed to create Pesapal order");
    }

    return res.json({
      success: true,
      payment_link: data.redirect_url,
      merchant_reference,
    });
  } catch (err) {
    console.error("❌ createPesaPalOrder error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/* =====================================
   PESAPAL IPN HANDLER
===================================== */
exports.handlePesapalIPN = async (req, res) => {
  try {
    console.log("📬 Incoming Pesapal IPN:", req.query);

    const { OrderMerchantReference, OrderTrackingId } = req.query;

    if (!OrderMerchantReference || !OrderTrackingId) {
      return res.status(400).json({ error: "Missing query parameters" });
    }

    const token = await getPesapalToken();

    const statusResp = await fetch(
      `${BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${OrderTrackingId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    const statusData = await statusResp.json();
    console.log("🔍 Transaction status:", statusData);

    const paymentStatus = (
      statusData.payment_status_description ||
      statusData.status ||
      ""
    ).toUpperCase();

    const paymentResult = await query(
      `SELECT user_id, plan_name, amount, status 
       FROM payments 
       WHERE merchant_reference = $1`,
      [OrderMerchantReference]
    );

    if (!paymentResult.rows.length) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const payment = paymentResult.rows[0];

    const userResult = await query(
      `SELECT email, full_name FROM users WHERE id = $1`,
      [payment.user_id]
    );

    const user = userResult.rows[0];

    const successStates = ["COMPLETED", "SUCCESS", "PAID"];
    const failedStates = ["FAILED", "CANCELLED", "REVERSED", "INVALID"];

    if (successStates.includes(paymentStatus)) {
      if (payment.status !== "success") {
        await query(
          `UPDATE payments SET status = 'success' WHERE merchant_reference = $1`,
          [OrderMerchantReference]
        );

        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(startDate.getDate() + 30);

    if (payment.status === "success") {
        console.log("⚠️ IPN already processed, skipping.");
        return res.json({ received: true, duplicate: true });
      }


        await query(
          `INSERT INTO subscriptions
           (user_id, plan_name, price, listings_allowed, listings_used, start_date, end_date, status)
           VALUES ($1,$2,$3,50,0,$4,$5,'active')
           ON CONFLICT (user_id)
           DO UPDATE SET
             plan_name = EXCLUDED.plan_name,
             price = EXCLUDED.price,
             listings_allowed = EXCLUDED.listings_allowed,
             listings_used = 0,
             start_date = EXCLUDED.start_date,
             end_date = EXCLUDED.end_date,
             status = 'active'`,
          [
            payment.user_id,
            payment.plan_name,
            payment.amount,
            startDate.toISOString(),
            endDate.toISOString(),
          ]
        );

        await query(`UPDATE users SET role='dealer' WHERE id=$1`, [
          payment.user_id,
        ]);

        await query(
          `INSERT INTO user_roles (user_id, role)
           VALUES ($1,'dealer')
           ON CONFLICT (user_id)
           DO UPDATE SET role='dealer'`,
          [payment.user_id]
        );

        if (user && user.email) {
          await sendMassEmail(
            [user.email],
            "Payment Successful",
            `Hi ${user.full_name || "there"},<br/><br/>
             Your payment of <b>KES ${payment.amount}</b> for the 
             <b>${payment.plan_name}</b> plan was successful.<br/>
             Your dealer account is now active for 30 days.<br/><br/>
             <a href="${FRONTEND_URL}/dashboard">Go to Dashboard</a>`
          );
        }
      }
    } else if (failedStates.includes(paymentStatus)) {
      await query(
        `UPDATE payments SET status='failed' WHERE merchant_reference=$1`,
        [OrderMerchantReference]
      );

      if (user && user.email) {
        await sendMassEmail(
          [user.email],
          "Payment Failed",
          `Hi ${user.full_name || "there"},<br/><br/>
           Your payment for <b>${payment.plan_name}</b> failed.<br/>
           <a href="${FRONTEND_URL}/pricing">Retry Payment</a>`
        );
      }
    }

    return res.json({ received: true });
  } catch (err) {
    console.error("❌ Pesapal IPN error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/* =====================================
   PAYMENT STATUS CHECK
===================================== */
exports.paymentstatus = async (req, res) => {
  try {
    const { merchant_reference } = req.params;

    if (!merchant_reference) {
      return res.status(400).json({ error: "Missing merchant_reference" });
    }

    const result = await query(
      `SELECT * FROM payments WHERE merchant_reference=$1`,
      [merchant_reference]
    );

    if (!result.rows.length) {
      return res.status(404).json({ error: "Payment not found" });
    }

    const payment = result.rows[0];
    const token = await getPesapalToken();
    

    const trackingId = payment.tracking_id || payment.merchant_reference;

    const resp = await fetch(
      `${BASE_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${trackingId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );


    if (!resp.ok) {
        const errBody = await resp.text();
        console.error("❌ Pesapal Status Fetch Error:", errBody);
        return res.status(502).json({
             success: false,
             error: "Failed to get transaction status from Pesapal",
          });
      }

    const statusData = await resp.json();
    const pesapalStatus =
      statusData.payment_status_description?.toUpperCase() || "FAILED";

    let frontendStatus = "failed";
    if (["COMPLETED", "SUCCESS", "PAID"].includes(pesapalStatus))
      frontendStatus = "success";
    else if (["PENDING", "PROCESSING"].includes(pesapalStatus))
      frontendStatus = "pending";
    else if (["CANCELLED", "FAILED", "REVERSED"].includes(pesapalStatus))
      frontendStatus = "cancelled";

    if (frontendStatus !== payment.status) {
      await query(
        `UPDATE payments SET status=$1 WHERE merchant_reference=$2`,
        [frontendStatus, merchant_reference]
      );
    }

    return res.json({
      success: true,
      merchant_reference,
      status: frontendStatus,
      pesapal_status: pesapalStatus,
    });
  } catch (err) {
    console.error("❌ paymentstatus error:", err);
    return res.status(500).json({ error: err.message });
  }
};


// submit after payment
exports.submitAfterPayment = async (req, res) => {
  try {
    const {
      user_id,
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
      galleryFiles,
      hasVideo,
      plan,
    } = req.body;

    if (!user_id) {
      return res
        .status(400)
        .json({ success: false, error: "Missing user_id" });
    }

    const dealer = await supabase
      .from("dealers")
      .select("id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!dealer || !dealer.data) {
      return res
        .status(400)
        .json({ success: false, error: "Dealer not found" });
    }

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
        has_video: hasVideo || false,
        featured: plan === "premium",
        status: "active", // auto-approved after payment
        dealer_id: dealer.data.id,
      },
    ]);

    if (error) {
      console.error("❌ Car insert error:", error);
      throw error;
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("❌ submitAfterPayment error:", err);
    return res
      .status(500)
      .json({ success: false, error: err.message });
  }
};

//activate free trial
exports.activateFreeTrial = async (req, res) => {
  console.log("📌 Trial Activation Endpoint Hit");

  try {
    const { user_id, email, full_name, phone, country } = req.body;

    if (!user_id || !email) {
      return res.status(400).json({
        success: false,
        error: "Missing user details",
      });
    }

    const { rows } = await query(
      `SELECT id, role, trial_end, trial_used, full_name, email
       FROM users WHERE id = $1`,
      [user_id]
    );

    const existing = rows[0];

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "User not found" });
    }

    const now = new Date();
    const trialEnd = existing.trial_end
      ? new Date(existing.trial_end)
      : null;

    // ❌ Already used
    if (existing.trial_used) {
      return res.status(403).json({
        success: false,
        error: "Free trial has already been used.",
      });
    }

    // ❌ Still active
    if (trialEnd && trialEnd > now) {
      return res.json({
        success: true,
        alreadyHasTrial: true,
        message: "Active trial already exists",
      });
    }

    // ❌ Admin skip
    if (existing.role === "admin") {
      return res.json({
        success: true,
        role: existing.role,
        message: "Admins do not require a free trial.",
      });
    }

    const trialStart = now;
    const newTrialEnd = new Date(now);
    newTrialEnd.setDate(now.getDate() + 7);

    await query(
      `
      UPDATE users
      SET role = 'dealer',
          trial_start = $1,
          trial_end = $2,
          trial_used = true,
          updated_at = NOW()
      WHERE id = $3
      `,
      [trialStart.toISOString(), newTrialEnd.toISOString(), user_id]
    );

    // Ensure dealer exists
    const dealerCheck = await query(
      `SELECT id FROM dealers WHERE user_id = $1`,
      [user_id]
    );

    if (dealerCheck.rows.length === 0) {
      await query(
        `
        INSERT INTO dealers
        (user_id, full_name, email, phone, country, status, created_at)
        VALUES ($1,$2,$3,$4,$5,'pending',NOW())
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

    await sendTrialActivationEmail(email, newTrialEnd);

    return res.json({
      success: true,
      role: "dealer",
      trial_start: trialStart,
      trial_end: newTrialEnd,
    });
  } catch (err) {
    console.error("❌ Free Trial Error:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
};




/* =====================================
   REGISTER PESAPAL IPN
===================================== */
exports.registerPesapalIPN = async (req, res) => {
  try {
    const token = await getPesapalToken();

    const payload = {
      url: PESAPAL_IPN_URL,
      ipn_notification_type: "GET",
    };

    const resp = await fetch(`${BASE_URL}/api/URLSetup/RegisterIPN`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(400).json({ error: data });
    }

    return res.json({ success: true, data });
  } catch (err) {
    console.error("❌ registerPesapalIPN error:", err);
    return res.status(500).json({ error: err.message });
  }
};

/* =====================================
   GET ALL PAYMENTS
===================================== */
exports.getAllPayments = async (req, res) => {
  try {
    const result = await query(
      `SELECT p.*, u.full_name, u.email
       FROM payments p
       LEFT JOIN users u ON p.user_id = u.id
       ORDER BY p.created_at DESC`
    );

    res.json({ success: true, payments: result.rows });
  } catch (err) {
    console.error("❌ getAllPayments error:", err);
    res.status(500).json({ error: err.message });
  }
};

/* =====================================
   TRIAL REMINDER JOB
===================================== */
exports.trialReminderJob = async () => {
  try {
    const now = DateTime.now();
    const tomorrow = now.plus({ days: 1 }).toISODate();

    // 🔔 Reminder (1 day before expiry)
    const reminderResult = await query(
      `
      SELECT id, email, trial_end
      FROM users
      WHERE role = 'dealer'
        AND trial_reminder_sent = false
        AND trial_end::date = $1
      `,
      [tomorrow]
    );

    for (const user of reminderResult.rows) {
      const trialEnd = DateTime.fromISO(user.trial_end).toJSDate();

      const emailRes = await sendTrialReminderEmail(user.email, trialEnd);

      if (!emailRes?.error) {
        await query(
          `UPDATE users SET trial_reminder_sent = true WHERE id = $1`,
          [user.id]
        );
      }
    }

    // ⛔ Expired trials
    const expiredResult = await query(
      `
      SELECT id, email
      FROM users
      WHERE trial_end < $1
        AND role != 'admin'
      `,
      [now.toISO()]
    );

    for (const user of expiredResult.rows) {
      await query(
        `
        UPDATE users
        SET role = 'user',
            trial_end = NULL,
            trial_reminder_sent = true,
            has_used_trial = true
        WHERE id = $1
        `,
        [user.id]
      );
    }
  } catch (err) {
    console.error("⚠️ Trial reminder job error:", err.message);
  }
};


/* =====================================
   CRON
===================================== */
cron.schedule("0 0 * * *", exports.trialReminderJob);
