const cron = require("node-cron");
const { query } = require("../db");

const startSubscriptionExpiryJob = () => {
  cron.schedule("0 0 * * *", async () => {
    try {
      console.log("🕛 Running nightly subscription expiry job...");

      const result = await query(`
        UPDATE dealer_subscriptions
        SET status = 'expired'
        WHERE status = 'active'
          AND end_date < now()
      `);

      console.log(`✅ ${result.rowCount} subscriptions expired`);
    } catch (err) {
      console.error("❌ Subscription expiry job failed:", err);
    }
  });
};

module.exports = { startSubscriptionExpiryJob };
