const cron = require("node-cron");
const { query } = require("../db");
const logger = require("../logger");
const {
  sendSubscriptionExpiryEmail,
  sendSubscriptionExpiredEmail,
} = require("../controllers/emailController");

const checkExpiredSubscriptions = async () => {
  logger.info("⏰ Checking for expiring subscriptions...");

  try {
    const expiringResult = await query(
      `SELECT s.id, s.dealer_id, s.plan_name, s.end_date,
              d.email AS dealer_email,
              u.email AS user_email
       FROM dealer_subscriptions s
       LEFT JOIN dealers d ON d.id = s.dealer_id
       LEFT JOIN users u ON u.id = d.user_id
       WHERE s.end_date BETWEEN NOW() AND NOW() + INTERVAL '3 days'
         AND s.status = 'active'
       ORDER BY s.end_date ASC`
    );

    for (const sub of expiringResult.rows) {
      const recipient = sub.dealer_email || sub.user_email;
      if (!recipient) {
        logger.warn(`⚠️ Subscription ${sub.id} has no email address to notify.`);
        continue;
      }

      const endDate = new Date(sub.end_date);
      logger.info(`⚠️ Subscription ${sub.id} for dealer ${sub.dealer_id} expires on ${sub.end_date}`);
      await sendSubscriptionExpiryEmail(recipient, sub.plan_name, endDate);
    }

    const expiredResult = await query(
      `SELECT s.id, s.dealer_id, s.plan_name, d.email AS dealer_email, u.email AS user_email
       FROM dealer_subscriptions s
       LEFT JOIN dealers d ON d.id = s.dealer_id
       LEFT JOIN users u ON u.id = d.user_id
       WHERE s.end_date < NOW()
         AND s.status = 'active'`
    );

    for (const sub of expiredResult.rows) {
      const recipient = sub.dealer_email || sub.user_email;
      if (recipient) {
        await sendSubscriptionExpiredEmail(recipient, sub.plan_name);
      }

      await query(
        `UPDATE dealer_subscriptions
         SET status = 'expired'
         WHERE id = $1`,
        [sub.id]
      );
    }

    logger.info("✅ Expiry check complete.");
    return { expiring: expiringResult.rowCount || 0, expired: expiredResult.rowCount || 0 };
  } catch (err) {
    logger.error("❌ Expiry job failed:", err);
    throw err;
  }
};

cron.schedule("0 9 * * *", checkExpiredSubscriptions);

module.exports = { checkExpiredSubscriptions };
