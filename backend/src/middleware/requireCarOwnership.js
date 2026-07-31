const { query } = require("../db");

const requireCarOwnership = async (req, res, next) => {
  try {
    const dealerResult = await query(
      `SELECT id FROM dealers WHERE user_id = $1 LIMIT 1`,
      [req.user?.id]
    );
    const dealerId = dealerResult.rows[0]?.id;
    if (!dealerId) {
      return res.status(404).json({ message: "Dealer profile not found" });
    }
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
    req.car = rows[0];

    next();
  } catch (err) {
    console.error("❌ requireCarOwnership:", err);
    res.status(500).json({ message: "Ownership validation failed" });
  }
};

module.exports = {
  requireCarOwnership,
};
