const { query } = require("../db");

const requireActiveDealer = async (req, res, next) => {
  try {
    const dealerId = req.user?.dealer_id; // set by auth middleware

    if (!dealerId) {
      return res.status(403).json({ error: "Dealer not found" });
    }

    const { rows } = await query(
      `
      SELECT dealer_has_active_access($1) AS allowed
      `,
      [dealerId]
    );

    if (!rows[0]?.allowed) {
      return res.status(402).json({
        error: "Subscription expired",
        redirect: "/pricing",
      });
    }

    next();
  } catch (err) {
    console.error("❌ requireActiveDealer:", err);
    res.status(500).json({ error: "Billing check failed" });
  }
};

module.exports = {
  requireActiveDealer,
};
