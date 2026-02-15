const cron = require("node-cron");
const { query } = require("../db");

const startSubscriptionExpiryJob = () => {
  // Runs every day at midnight
  cron.schedule("0 0 * * *", async () => {
    try {
      console.log("🕛 Running nightly subscription expiry job...");

      const result = await query(`
        UPDATE dealer_subscriptions
        SET
          status = 'expired',
          grace_until = now() + interval '7 days'
        WHERE
          status = 'active'
          AND end_date < now()
      `);

      console.log(`✅ ${result.rowCount} subscriptions expired`);
    } catch (err) {
      console.error("❌ Subscription expiry job failed:", err);
    }
  });
};

module.exports = { startSubscriptionExpiryJob };
