import { Router } from "express";
import { query } from "../db";
const router = Router();

/* =========================================================
   POST /api/cars – Create car listing
========================================================= */
router.post("/", async (req: any, res) => {
  try {
    const userId = req.user.id;

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

    /* ---------- Validation ---------- */
    if (
      !make ||
      !model ||
      !year ||
      !price ||
      !mileage ||
      !condition ||
      !Array.isArray(gallery) ||
      gallery.length === 0
    ) {
      return res.status(400).json({
        error: "Missing or invalid required fields",
      });
    }

    /* ---------- Get dealer ---------- */
    const dealerResult = await query(
      `SELECT id FROM dealers WHERE user_id = $1`,
      [userId]
    );

    if (!dealerResult.rows.length) {
      return res.status(403).json({
        error: "You are not registered as a dealer",
      });
    }

    const dealerId = dealerResult.rows[0].id;

    /* ---------- Insert ---------- */
    const { rows } = await query(
      `
      INSERT INTO cars (
        make, model, year, price, mileage, location,
        description, condition, gallery, video_url,
        transmission, phone, dealer_id, status
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,
        $7,$8,$9,$10,
        $11,$12,$13,'pending'
      )
      RETURNING *
      `,
      [
        make,
        model,
        year,
        price,
        mileage,
        location ?? null,
        description ?? null,
        condition,
        gallery,
        video_url ?? null,
        transmission ?? null,
        phone ?? null,
        dealerId,
      ]
    );

    res.status(201).json({
      message: "Car submitted successfully",
      car: rows[0],
    });
  } catch (err: any) {
    console.error("CREATE CAR ERROR:", err);
    res.status(500).json({
      error: "Failed to create car listing",
    });
  }
});

/* =========================================================
   PUT /api/cars/:id – Edit car listing
========================================================= */
router.put("/:id", async (req: any, res) => {
  try {
    const userId = req.user.id;
    const carId = req.params.id;

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

    /* ---------- Find dealer ---------- */
    const dealerResult = await query(
      `SELECT id FROM dealers WHERE user_id = $1`,
      [userId]
    );

    if (!dealerResult.rows.length) {
      return res.status(403).json({ error: "Not a dealer" });
    }

    const dealerId = dealerResult.rows[0].id;

    /* ---------- Ownership check ---------- */
    const carCheck = await query(
      `SELECT id FROM cars WHERE id = $1 AND dealer_id = $2`,
      [carId, dealerId]
    );

    if (!carCheck.rows.length) {
      return res.status(404).json({
        error: "Car not found or not owned by you",
      });
    }

    /* ---------- Update ---------- */
    const { rows } = await query(
      `
      UPDATE cars SET
        make = $1,
        model = $2,
        year = $3,
        price = $4,
        mileage = $5,
        location = $6,
        description = $7,
        condition = $8,
        gallery = $9,
        video_url = $10,
        transmission = $11,
        phone = $12,
        status = 'pending',
        updated_at = NOW()
      WHERE id = $13
      RETURNING *
      `,
      [
        make,
        model,
        year,
        price,
        mileage,
        location ?? null,
        description ?? null,
        condition,
        gallery ?? [],
        video_url ?? null,
        transmission ?? null,
        phone ?? null,
        carId,
      ]
    );

    res.json({
      message: "Car updated successfully",
      car: rows[0],
    });
  } catch (err) {
    console.error("UPDATE CAR ERROR:", err);
    res.status(500).json({
      error: "Failed to update car",
    });
  }
});

export default router;