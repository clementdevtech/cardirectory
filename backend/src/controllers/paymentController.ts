import { Request, Response } from "express";
import fetch from "node-fetch";
import { supabase } from "../supabaseClient";
import { sendMassEmail } from "./emailController";

// ✅ Environment Setup
const CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY!;
const CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET!;
const PESAPAL_NOTIFICATION_ID = process.env.PESAPAL_NOTIFICATION_ID;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";

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

    // ✅ Unique order reference
    const merchant_reference = `ORDER-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const callback_url = process.env.PESAPAL_IPN_URL;

    // ✅ Save payment as pending
    const { error: insertErr } = await supabase.from("payments").insert([
      {
        user_id,
        plan_name: plan,
        amount,
        method: "pesapal",
        phone,
        status: "pending",
        merchant_reference,
      },
    ]);
    if (insertErr) throw insertErr;

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

    // ✅ Success: return payment link & reference
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

    // ✅ Step 2: Check transaction status from Pesapal
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

    // ✅ Step 3: Fetch payment in your DB
    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("user_id, plan_name, amount, status")
      .eq("merchant_reference", merchant_reference)
      .single();

    if (fetchError || !payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    // ✅ Get user email
    const { data: user } = await supabase
      .from("users")
      .select("email, full_name")
      .eq("id", payment.user_id)
      .single();

    // ✅ Step 4: Define possible outcomes
    const successStates = ["COMPLETED", "SUCCESS", "PAID"];
    const failedStates = ["FAILED", "CANCELLED", "REVERSED", "INVALID"];

    if (successStates.includes(paymentStatus)) {
      // If payment succeeded and not already marked success
      if (payment.status !== "success") {
        await supabase
          .from("payments")
          .update({ status: "success" })
          .eq("merchant_reference", merchant_reference);

        // Create or update subscription
        const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

        await supabase.from("subscriptions").upsert({
          user_id: payment.user_id,
          plan_name: payment.plan_name,
          price: payment.amount,
          listings_allowed: 50,
          listings_used: 0,
          start_date: new Date().toISOString(),
          end_date: endDate,
          status: "active",
        });

        await supabase.from("users").update({ role: "dealer" }).eq("id", payment.user_id);

        await supabase
          .from("user_roles")
          .upsert([{ user_id: payment.user_id, role: "dealer" }], { onConflict: "user_id" });

        console.log(`✅ User ${payment.user_id} upgraded to dealer.`);

        // 📨 Send Success Email
        if (user?.email) {
          await sendMassEmail(
            [user.email],
            "Payment Successful",
            `Hi ${user.full_name || "there"},<br/><br/>
            Your payment of <b>KES ${payment.amount}</b> for the <b>${payment.plan_name}</b> plan was successful.<br/>
            Your dealer account has been activated and is valid for 30 days.<br/><br/>
            <a href="${process.env.FRONTEND_URL}/dashboard" class="btn">Go to Dashboard</a>`
          );
        }
      }
    } else if (failedStates.includes(paymentStatus)) {
      // Update payment to failed/cancelled
      await supabase
        .from("payments")
        .update({ status: "failed" })
        .eq("merchant_reference", merchant_reference);

      console.log(`❌ Payment ${merchant_reference} marked as failed.`);

      // 📨 Send Failure Email
      if (user?.email) {
        await sendMassEmail(
          [user.email],
          "Payment Failed or Cancelled",
          `Hi ${user.full_name || "there"},<br/><br/>
          Unfortunately, your payment for the <b>${payment.plan_name}</b> plan was not successful.<br/>
          If this was a mistake, please try again.<br/><br/>
          <a href="${process.env.FRONTEND_URL}/pricing" class="btn">Retry Payment</a>`
        );
      }
    }

    // ✅ Step 5: Respond OK to Pesapal
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
  console.log('checking payments status');
  try {
    const { merchant_reference } = req.params;

    if (!merchant_reference) {
      return res.status(400).json({ success: false, error: "Missing merchant_reference" });
    }

    // ✅ Get payment record
    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("*")
      .eq("merchant_reference", merchant_reference)
      .single();

    if (fetchError || !payment) {
      console.log('payments not found');
      return res.status(404).json({ success: false, error: "Payment not found" });
    }

    // ✅ Get Pesapal token
    const token = await getPesapalToken();

    // ✅ Prefer tracking_id, but fallback to merchant_reference if missing
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

    // ✅ Normalize statuses for frontend
    let frontendStatus: "success" | "pending" | "cancelled" | "failed" = "failed";

    if (["COMPLETED", "SUCCESS", "PAID"].includes(paymentStatus)) frontendStatus = "success";
    else if (["PENDING", "PROCESSING"].includes(paymentStatus)) frontendStatus = "pending";
    else if (["CANCELLED", "FAILED", "REVERSED"].includes(paymentStatus)) frontendStatus = "cancelled";

    // ✅ Optional: update DB if status changed
    if (frontendStatus !== payment.status) {
      await supabase
        .from("payments")
        .update({ status: frontendStatus })
        .eq("merchant_reference", merchant_reference);
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
 * STEP 5 — Register IPN (Run once to get notification_id)
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
