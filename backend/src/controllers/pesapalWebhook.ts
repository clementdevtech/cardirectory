import { Request, Response } from "express";
import { supabase } from "../supabaseClient";

export const handlePesaPalWebhook = async (req: Request, res: Response): Promise<Response | void> => {
  try {
    const body = req.body as {
      data?: {
        merchant_reference?: string;
        status?: string;
      };
    };

    const merchant_reference = body.data?.merchant_reference;
    const status = body.data?.status;

    if (!merchant_reference) {
      return res.status(400).json({ error: "Missing merchant_reference" });
    }

    // ✅ Fetch payment record
    const { data: payment, error: fetchError } = await supabase
      .from("payments")
      .select("user_id, plan_name, amount, status")
      .eq("merchant_reference", merchant_reference)
      .single();

    if (fetchError || !payment) {
      return res.status(404).json({ error: "Reference not found" });
    }

    if (status === "COMPLETED" && payment.status !== "success") {
      // ✅ Update payment status
      await supabase
        .from("payments")
        .update({ status: "success" })
        .eq("merchant_reference", merchant_reference);

      // ✅ Create or update subscription
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

      // ✅ Promote user to dealer
      await supabase.from("users").update({ role: "dealer" }).eq("id", payment.user_id);

      // ✅ Fix your original error here:
      await supabase
        .from("user_roles")
        .upsert([{ user_id: payment.user_id, role: "dealer" }], { onConflict: "user_id" });
      // 👆 MUST pass an *array* to upsert() when using onConflict
    }

    return res.status(200).json({ received: true });
  } catch (err: any) {
    console.error("❌ PesaPal webhook error:", err);
    return res.status(500).json({ error: err.message });
  }
};