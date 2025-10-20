import express, { Request, Response } from "express";
import { createDealer, getDealerById, setDealerVerified, validateDealer } from "../models/dealers";


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

// ✅ Get Dealer by ID (UUID-safe)
router.get("/:id", async (req: Request, res: Response) => {
  try {
    const id = req.params.id; // keep as string (uuid)
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
      return res.status(400).json({ success: false, message: "national_id and kra_pin required" });
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
    if (!success) return res.status(400).json({ success: false, message: "Could not verify dealer" });

    res.json({ success: true, message: `Dealer ${id} verified successfully` });
  } catch (err) {
    console.error("Verify dealer error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
