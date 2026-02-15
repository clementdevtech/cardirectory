const cron = require("node-cron");
const { pool } = require("../db");
const logger = require("../logger");

// Runs every day at 9 AM
cron.schedule("0 9 * * *", async () => {
  logger.info("⏰ Checking for expiring subscriptions...");

  try {
    // Find subscriptions expiring in next 3 days
    const { rows: expiring } = await pool.query(
      `SELECT id, dealer_id, plan_name, end_date
       FROM subscriptions
       WHERE end_date BETWEEN NOW() AND NOW() + INTERVAL '3 days'
       AND status = 'active'`
    );

    for (const sub of expiring) {
      logger.info(
        `⚠️ Subscription ${sub.id} for dealer ${sub.dealer_id} expires on ${sub.end_date}`
      );

      // TODO: send SMS/email here
    }

    // Expire outdated subscriptions
    await pool.query(
      `UPDATE subscriptions
       SET status = 'expired'
       WHERE end_date < NOW()
       AND status = 'active'`
    );

    logger.info("✅ Expiry check complete.");
  } catch (err) {
    logger.error("❌ Expiry job failed:", err);
  }
});
