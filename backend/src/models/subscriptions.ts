import { query } from "../db";
import dayjs from "dayjs";

export async function createSubscription(opts: {
  dealer_id: number;
  plan_name: string;
  listings_allowed: number;
  start_date?: string;
  duration_days: number;
}) {
  const start = opts.start_date ?? dayjs().toISOString();
  const end = dayjs(start).add(opts.duration_days, "day").toISOString();
  const res = await query(
    `INSERT INTO subscriptions (dealer_id, plan_name, listings_allowed, listings_used, start_date, end_date, active)
     VALUES ($1,$2,$3,0,$4,$5,true) RETURNING *`,
    [opts.dealer_id, opts.plan_name, opts.listings_allowed, start, end]
  );
  return res.rows[0];
}

export async function getActiveSubscription(dealer_id: number) {
  const res = await query(
    `SELECT * FROM subscriptions WHERE dealer_id = $1 AND active = true AND end_date > now() ORDER BY end_date DESC LIMIT 1`,
    [dealer_id]
  );
  return res.rows[0];
}

export async function incrementListingsUsed(subscription_id: number) {
  await query(
    `UPDATE subscriptions SET listings_used = listings_used + 1 WHERE id = $1`,
    [subscription_id]
  );
}
