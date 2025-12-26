import { Request, Response } from "express";
import { query } from "../db";

/**
 * CREATE or UPDATE CAR DRAFT
 */
export const saveCarDraft = async (req: Request, res: Response) => {
  try {
    const dealerId = (req as any).user.dealer_id;

    const {
      id,
      make,
      model,
      year,
      mileage,
      price,
      condition,
      transmission,
      location,
      description,
      phone,
      gallery,
      video_url,
    } = req.body;

    // UPDATE EXISTING DRAFT
    if (id) {
      const { rows } = await query(
        `
        UPDATE cars
        SET make=$1,
            model=$2,
            year=$3,
            mileage=$4,
            price=$5,
            condition=$6,
            transmission=$7,
            location=$8,
            description=$9,
            phone=$10,
            gallery=$11,
            video_url=$12
        WHERE id=$13 AND dealer_id=$14
        RETURNING *
        `,
        [
          make,
          model,
          year,
          mileage,
          price,
          condition,
          transmission,
          location,
          description,
          phone,
          gallery,
          video_url,
          id,
          dealerId,
        ]
      );

      return res.json(rows[0]);
    }

    // CREATE NEW DRAFT
    const { rows } = await query(
      `
      INSERT INTO cars
      (
        dealer_id,
        make,
        model,
        year,
        mileage,
        price,
        condition,
        transmission,
        location,
        description,
        phone,
        gallery,
        status
      )
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'pending')
      RETURNING *
      `,
      [
        dealerId,
        make,
        model,
        year,
        mileage,
        price,
        condition,
        transmission,
        location,
        description,
        phone,
        gallery,
      ]
    );

    return res.status(201).json(rows[0]);
  } catch (err: any) {
    console.error("❌ saveCarDraft error:", err.message);
    return res.status(500).json({ message: "Failed to save draft" });
  }
};

/**
 * FINAL SUBMIT (lock listing for moderation)
 */
export const submitCarListing = async (req: Request, res: Response) => {
  try {
    const dealerId = (req as any).user.dealer_id;
    const { id } = req.params;

    await query(
      `
      UPDATE cars
      SET status='pending'
      WHERE id=$1 AND dealer_id=$2
      `,
      [id, dealerId]
    );

    return res.json({ success: true });
  } catch (err: any) {
    console.error("❌ submitCarListing error:", err.message);
    return res.status(500).json({ message: "Failed to submit listing" });
  }
};
