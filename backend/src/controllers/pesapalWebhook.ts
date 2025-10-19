import { Request, Response } from "express";
import { supabase } from "../supabaseClient";

export const handlePesaPalWebhook = async (req: Request, res: Response) => {
  try {
    const body = req.body;

    // PesaPal sends various fields; in API 3.0 JSON format status updates are posted (see docs) :contentReference[oaicite:2]{index=2}
    const merchant_reference = body.data?.merchant_reference;
    const status = body.data?.status;

    if (!merchant_reference) {
      return res.status(400).end();
    }

    // find payment
    const { data: payment } = await supabase
      .from("payments")
      .select("user_id, plan_name, amount, status")
      .eq("merchant_reference", merchant_reference)
      .single();

    if (!payment) {
      // unknown reference
      return res.status(404).json({ error: "Reference not found" });
    }

    if (status === "COMPLETED" && payment.status !== "success") {
      // update payment status
      await supabase
        .from("payments")
        .update({ status: "success" })
        .eq("merchant_reference", merchant_reference);

      // create subscription (30 days for example)
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      await supabase.from("subscriptions").upsert({
        user_id: payment.user_id,
        plan_name: payment.plan_name,
        price: payment.amount,
        listings_allowed: 50,   // example quota
        listings_used: 0,
        start_date: new Date().toISOString(),
        end_date: endDate,
        status: "active",
      });

      // promote user to dealer
      await supabase.from("users").update({ role: "dealer" }).eq("id", payment.user_id);
      await supabase.from("user_roles").upsert(
        { user_id: payment.user_id, role: "dealer" },
        { onConflict: ["user_id"] }
      );
    }

    // Respond back exactly as expected for IPN
    res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("❌ PesaPal webhook error:", err);
    res.status(500).json({ error: err.message });
  }
};
