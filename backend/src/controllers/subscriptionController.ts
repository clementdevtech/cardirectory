import { Request, Response } from "express";
import { supabase } from "../supabaseClient.js";

/**
 * Called after successful payment or plan selection.
 * Updates subscription table and promotes user to dealer.
 */
export const activateSubscription = async (req: Request, res: Response) => {
  try {
    const { user_id, plan, end_date } = req.body;

    if (!user_id || !plan) {
      return res.status(400).json({ success: false, error: "Missing user_id or plan" });
    }

    // 1️⃣ Check if dealer record exists
    const { data: existingDealer, error: dealerError } = await supabase
      .from("dealers")
      .select("id")
      .eq("user_id", user_id)
      .maybeSingle();

    if (dealerError) throw dealerError;

    // 2️⃣ If dealer doesn’t exist → create one
    let dealerId = existingDealer?.id;
    if (!dealerId) {
      const { data: newDealer, error: createDealerError } = await supabase
        .from("dealers")
        .insert([
          {
            user_id,
            full_name: "Dealer User", // you can override from frontend
            email: "", // optional
            status: "active",
          },
        ])
        .select("id")
        .single();

      if (createDealerError) throw createDealerError;
      dealerId = newDealer.id;
    }

    // 3️⃣ Insert or update subscription record
    const { error: subError } = await supabase
      .from("subscriptions")
      .upsert({
        dealer_id: dealerId,
        plan,
        status: "active",
        start_date: new Date().toISOString(),
        end_date: end_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // default 30 days
      });

    if (subError) throw subError;

    // 4️⃣ Promote user to dealer in both tables
    const { error: userUpdateError } = await supabase
      .from("users")
      .update({ role: "dealer" })
      .eq("id", user_id);

    if (userUpdateError) throw userUpdateError;

    const { error: userRoleError } = await supabase
      .from("user_roles")
      .upsert({ user_id, role: "dealer" }, { onConflict: "user_id" });

    if (userRoleError) throw userRoleError;

    return res.json({ success: true, message: "Subscription activated and user promoted to dealer." });
  } catch (error: any) {
    console.error("❌ Subscription activation error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Subscription activation failed.",
    });
  }
};
