import cron from "node-cron";
import { query } from "../db";

export const startSubscriptionExpiryJob = () => {
  cron.schedule("0 0 * * *", async () => {
    try {
      console.log("🕛 Running nightly subscription expiry job...");

      const { rowCount } = await query(`
        UPDATE dealer_subscriptions
        SET
          status = 'expired',
          grace_until = now() + interval '7 days'
        WHERE
          status = 'active'
          AND end_date < now()
      `);

      console.log(`✅ ${rowCount} subscriptions expired`);
    } catch (err) {
      console.error("❌ Subscription expiry job failed:", err);
    }
  });
};
