import { Request, Response } from "express";
import crypto from "crypto";
import fetch from "node-fetch";
import { supabase } from "../supabaseClient";



const CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY!;
const CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET!;
const ENV = process.env.PESAPAL_ENVIRONMENT === "production" ? "live" : "sandbox";

const BASE_URL =
  ENV === "sandbox"
    ? "https://cybqa.pesapal.com/pesapalv3"
    : "https://pay.pesapal.com/v3";

/**
 * STEP 1 — Get Pesapal Access Token
 * (Pesapal v3 now uses OAuth2, not OAuth1)
 */
async function getPesapalToken(): Promise<string> {
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

  return data.token;
}

/**
 * STEP 2 — Create order
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
    const callback_url = process.env.PESAPAL_IPN_URL || "https://your-domain.com/api/payments/pesapal/ipn";

    // Step 2.1 — Log pending transaction in DB
    const { error: insertErr } = await supabase
      .from("payments")
      .insert([
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

    // Step 2.2 — Obtain Pesapal token
    const token = await getPesapalToken();

    // Step 2.3 — Build order payload
    const order = {
      id: merchant_reference,
      currency: "KES",
      amount,
      description: `AutoKenya ${plan} plan subscription`,
      callback_url, // where Pesapal posts IPN updates
      notification_id: process.env.PESAPAL_NOTIFICATION_ID, // registered notification ID
      billing_address: {
        phone_number: phone,
        email_address: "", // optional
        country_code: "KE",
        first_name: "User",
        middle_name: "",
        last_name: "Subscriber",
        line_1: "",
        line_2: "",
        city: "Nairobi",
        state: "",
        postal_code: "",
        zip_code: "",
      },
    };

    // Step 2.4 — Create order
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

    const payment_link = data.redirect_url;

    return res.status(200).json({
      success: true,
      payment_link,
      merchant_reference,
    });
  } catch (err) {
    console.error("❌ createPesaPalOrder error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(500).json({ error: message });
  }
};


/**
 * Pesapal IPN (Webhook)
 * Called by Pesapal when payment status updates.
 */
export const handlePesapalIPN = async (req: Request, res: Response) => {
  try {
    const { OrderTrackingId, OrderMerchantReference, PaymentStatusDescription } = req.body;

    if (!OrderMerchantReference) {
      return res.status(400).json({ error: "Missing merchant reference" });
    }

    console.log("📬 Pesapal IPN received:", req.body);

    // 1️⃣ Update payment status in Supabase
    const { data: paymentData, error: updateError } = await supabase
      .from("payments")
      .update({ status: PaymentStatusDescription })
      .eq("merchant_reference", OrderMerchantReference)
      .select("user_id, plan_name, status")
      .single();

    if (updateError) throw updateError;
    if (!paymentData) throw new Error("Payment record not found");

    // 2️⃣ Check if payment was successful
    const successfulStatuses = ["COMPLETED", "SUCCESS", "PAID", "Payment Completed"];
    if (successfulStatuses.includes(PaymentStatusDescription.toUpperCase())) {
      const { user_id, plan_name } = paymentData;

      // 3️⃣ Update user role → dealer
      const { error: roleErr } = await supabase
        .from("users")
        .update({ role: "dealer" })
        .eq("id", user_id);

      if (roleErr) throw roleErr;

      // 4️⃣ Ensure entry exists in user_roles (if you have that table)
      const { data: existingRole } = await supabase
        .from("user_roles")
        .select("id")
        .eq("user_id", user_id)
        .maybeSingle();

      if (existingRole) {
        await supabase
          .from("user_roles")
          .update({ role: "dealer" })
          .eq("user_id", user_id);
      } else {
        await supabase
          .from("user_roles")
          .insert([{ user_id, role: "dealer" }]);
      }

      console.log(`✅ User ${user_id} upgraded to dealer after payment for ${plan_name}.`);
    } else {
      console.log(`⚠️ Payment not successful yet: ${PaymentStatusDescription}`);
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error("❌ IPN handling error:", err);
    return res.status(500).json({ error: (err as Error).message });
  }
};
