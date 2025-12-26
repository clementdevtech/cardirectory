import { Router } from "express";
import { query } from "../db";
import { verifyAuth } from "../middleware/requireAuth";

const router = Router();

// POST /api/cars - create a new car listing
router.post("/", verifyAuth, async (req: any, res) => {
  try {
    const userId = req.user.id; // from verifyAuth
    const {
      make,
      model,
      year,
      price,
      mileage,
      location,
      description,
      condition,
      gallery,
      video_url,
      transmission,
      phone,
    } = req.body;

    if (!make || !model || !year || !price || !mileage || !condition) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // 1️⃣ Fetch dealer_id for this user
    const dealerResult = await query(
      `SELECT id FROM dealers WHERE user_id = $1`,
      [userId]
    );

    if (!dealerResult.rows.length) {
      return res
        .status(400)
        .json({ error: "No dealer found for this user. Contact admin." });
    }

    const dealerId = dealerResult.rows[0].id;

    // 2️⃣ Insert car using the dealer_id
    const { rows } = await query(
      `INSERT INTO cars
      (make, model, year, price, mileage, location, description, condition, gallery, video_url, transmission, phone, dealer_id, status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'pending')
      RETURNING *`,
      [
        make,
        model,
        year,
        price,
        mileage,
        location || null,
        description || null,
        condition,
        gallery || [],
        video_url || null,
        transmission || null,
        phone || null,
        dealerId, // use correct dealer id
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
