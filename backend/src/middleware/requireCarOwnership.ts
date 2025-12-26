import { Request, Response, NextFunction } from "express";
import { query } from "../db";

export const requireCarOwnership = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const dealerId = (req as any).user.dealer_id;
    const carId = req.params.id || req.body.id;

    if (!carId) {
      return res.status(400).json({ message: "Car ID is required" });
    }

    const { rows } = await query(
      `
      SELECT *
      FROM cars
      WHERE id = $1 AND dealer_id = $2
      `,
      [carId, dealerId]
    );

    if (rows.length === 0) {
      return res.status(403).json({
        message: "You do not have permission to modify this listing",
      });
    }

    // attach car for downstream use
    (req as any).car = rows[0];

    next();
  } catch (err) {
    console.error("❌ requireCarOwnership:", err);
    res.status(500).json({ message: "Ownership validation failed" });
  }
};
