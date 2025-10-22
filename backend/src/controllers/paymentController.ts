import { Request, Response } from "express";
import fetch from "node-fetch";
import { supabase } from "../supabaseClient";

// ✅ Environment Setup
const CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY!;
const CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET!;
const ENV = process.env.PESAPAL_ENVIRONMENT === "production" ? "live" : "sandbox";

const BASE_URL =
  ENV === "sandbox"
    ? "https://cybqa.pesapal.com/pesapalv3"
    : "https://pay.pesapal.com/v3";

// ✅ Cached token (avoid fetching token repeatedly)
let cachedToken: string | null = null;
let tokenExpiry: number | null = null;

/**
 * STEP 1 — Get Pesapal Access Token (OAuth2)
 */
async function getPesapalToken(): Promise<string> {
  // Reuse valid token if available
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
  tokenExpiry = Date.now() + 55 * 60 * 1000; // Cache for ~55 minutes
  return data.token;
}

/**
 * STEP 2 — Create Pesapal Order
 */
export const createPesaPalOrder = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { user_id, plan, amount, phone } = req.body as {
      user_id: string;
      plan: string;
      amount: number;
      phone: string;
    };

    if (!user_id || !plan || !amount || !phone) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const merchant_reference = `ORDER-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const callback_url = process.env.PESAPAL_IPN_URL;

    // Log pending transaction
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

    if (insertErr) {
      console.error("❌ Supabase insert error:", insertErr);
      throw insertErr;
    }

    // Get token
    const token = await getPesapalToken();

    // Build order payload
    const order = {
      id: merchant_reference,
      currency: "KES",
      amount,
      description: `AutoKenya ${plan} plan subscription`,
      callback_url, // IPN webhook
      notification_id: process.env.PESAPAL_NOTIFICATION_ID, // from RegisterIPN
      billing_address: {
        phone_number: phone,
        email_address: "",
        country_code: "KE",
        first_name: "User",
        middle_name: "",
        last_name: "Subscriber",
        city: "Nairobi",
      },
    };

    // Create order
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

    return res.status(200).json({
      success: true,
      payment_link: data.redirect_url,
      merchant_reference,
    });
  } catch (err) {
    console.error("❌ createPesaPalOrder error:", err);
    return res.status(500).json({ error: (err as Error).message });
  }
};

/**
 * STEP 3 — Handle Pesapal IPN (Webhook)
 */
export const handlePesapalIPN = async (req: Request, res: Response) => {
  try {
    const { OrderTrackingId, OrderMerchantReference, PaymentStatusDescription } = req.body;

    if (!OrderMerchantReference) {
      return res.status(400).json({ error: "Missing merchant reference" });
    }

    console.log("📬 Pesapal IPN received:", req.body);

    // Update payment status in Supabase
    const { data: paymentData, error: updateError } = await supabase
      .from("payments")
      .update({ status: PaymentStatusDescription })
      .eq("merchant_reference", OrderMerchantReference)
      .select("user_id, plan_name, status")
      .single();

    if (updateError) throw updateError;
    if (!paymentData) throw new Error("Payment record not found");

    // Check if payment was successful
    const successfulStatuses = ["COMPLETED", "SUCCESS", "PAID", "Payment Completed"];
    if (successfulStatuses.includes(PaymentStatusDescription.toUpperCase())) {
      const { user_id, plan_name } = paymentData;

      // Update user role → dealer
      const { error: roleErr } = await supabase
        .from("users")
        .update({ role: "dealer" })
        .eq("id", user_id);

      if (roleErr) throw roleErr;

      // Update or insert user_roles entry
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (existingRole) {
        await supabase.from("user_roles").update({ role: "dealer" }).eq("user_id", user_id);
      } else {
        await supabase.from("user_roles").insert([{ user_id, role: "dealer" }]);
      }

      console.log(`✅ User ${user_id} upgraded to dealer after ${plan_name} payment.`);
    } else {
      console.log(`⚠️ Payment not successful yet: ${PaymentStatusDescription}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ IPN handling error:", err);
    return res.status(500).json({ error: (err as Error).message });
  }
};

/**
 * STEP 4 — Register IPN (Live)
 * Run once to get your PESAPAL_NOTIFICATION_ID
 */
export const registerPesapalIPN = async (req: Request, res: Response) => {
  try {
    const token = await getPesapalToken();

    const payload = {
      url: process.env.PESAPAL_IPN_URL, // must be live HTTPS webhook
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
