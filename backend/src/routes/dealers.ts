import express, { Request, Response } from "express";
import { supabase } from "../supabaseClient";
import {
  createDealer,
  getDealerById,
  setDealerVerified,
  validateDealer,
} from "../models/dealers";

const router = express.Router();

// ✅ Create Dealer
router.post("/", async (req: Request, res: Response) => {
  try {
    const { name, email, phone, country } = req.body;
    const dealer = await createDealer({ name, email, phone, country });
    res.json({ success: true, dealer });
  } catch (err) {
    console.error("Create dealer error:", err);
    res.status(500).json({ success: false, error: "Failed to create dealer" });
  }
});

// ✅ Get Dealer by ID
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const dealer = await getDealerById(id);
    if (!dealer) return res.status(404).json({ error: "Dealer not found" });
    res.json({ success: true, dealer });
  } catch (err) {
    console.error("Get dealer error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// ✅ Validate Dealer with National ID & KRA
router.post("/validate", async (req: Request, res: Response) => {
  try {
    const { national_id, kra_pin } = req.body;
    if (!national_id || !kra_pin) {
      return res.status(400).json({
        success: false,
        message: "national_id and kra_pin required",
      });
    }

    const result = await validateDealer(national_id, kra_pin);
    if (!result.success) return res.status(400).json(result);

    res.json({ success: true, data: result.data });
  } catch (err) {
    console.error("Validation error:", err);
    res.status(500).json({ success: false, message: "Validation service error" });
  }
});

// ✅ Mark Dealer as Verified
router.post("/:id/verify", async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const success = await setDealerVerified(id);
    if (!success)
      return res
        .status(400)
        .json({ success: false, message: "Could not verify dealer" });

    res.json({ success: true, message: `Dealer ${id} verified successfully` });
  } catch (err) {
    console.error("Verify dealer error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ✅ Auto-promote users after free trial ends
router.post("/auto-promote", async (req: Request, res: Response) => {
  try {
    const now = new Date().toISOString();

    // 🧩 1. Get all users with expired trials and not dealers yet
    const { data: expiredUsers, error } = await supabase
      .from("users")
      .select("*")
      .eq("role", "user")
      .lt("trial_end", now);

    if (error) throw error;

    if (!expiredUsers || expiredUsers.length === 0) {
      return res.json({ message: "No users eligible for promotion" });
    }

    // 🧩 2. Promote them to dealers in both tables
    for (const u of expiredUsers) {
      // Update users table
      await supabase
        .from("users")
        .update({ role: "dealer" })
        .eq("id", u.id);

      // Ensure they exist in dealers table
      await supabase
        .from("dealers")
        .upsert({
          user_id: u.id,
          email: u.email,
          full_name: u.full_name || `${u.first_name} ${u.last_name}`,
          verified: false,
          created_at: new Date().toISOString(),
        });
    }

    res.json({
      success: true,
      message: `${expiredUsers.length} user(s) promoted to dealer.`,
    });
  } catch (err: any) {
    console.error("Auto-promotion error:", err);
    res.status(500).json({
      success: false,
      message: "Failed to auto-promote users",
      error: err.message,
    });
  }
});

export default router;
