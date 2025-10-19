import express from "express";
import { createDealer, getDealerById, setDealerVerified } from "../models/dealers";
const router = express.Router();

router.post("/", async (req, res) => {
  const { name, email, phone, country } = req.body;
  const dealer = await createDealer({ name, email, phone, country });
  res.json(dealer);
});

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const d = await getDealerById(id);
  if (!d) return res.status(404).json({ error: "not found" });
  res.json(d);
});

// verification callback from third-party validators
router.post("/validate", async (req, res) => {
  const { national_id, kra_pin } = req.body;
  if (!national_id || !kra_pin)
    return res.status(400).json({ error: "national_id and kra_pin required" });

  const result = await validateDealer(national_id, kra_pin);
  if (!result.success) return res.status(400).json(result);
  res.json(result);
});

export default router;
