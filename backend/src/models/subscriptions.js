const { query } = require("../db");
const dayjs = require("dayjs");

async function createSubscription(opts) {
  const start = opts.start_date ?? dayjs().toISOString();
  const end = dayjs(start)
    .add(opts.duration_days, "day")
    .toISOString();

  const res = await query(
    `
    INSERT INTO dealer_subscriptions
      (dealer_id, plan_name, listing_limit, start_date, end_date, status)
    VALUES ($1,$2,$3,$4,$5,'active')
    RETURNING *
    `,
    [
      opts.dealer_id,
      opts.plan_name,
      opts.listing_limit ?? opts.listings_allowed ?? 0,
      start,
      end,
    ]
  );

  return res.rows[0];
}

async function getActiveSubscription(dealer_id) {
  const res = await query(
    `
    SELECT *
    FROM dealer_subscriptions
    WHERE dealer_id = $1
      AND status = 'active'
      AND end_date > now()
    ORDER BY end_date DESC
    LIMIT 1
    `,
    [dealer_id]
  );

  return res.rows[0];
}

async function incrementListingsUsed(subscription_id) {
  await query(
    `
    UPDATE dealer_subscriptions
    SET listing_limit = listing_limit
    WHERE id = $1
    `,
    [subscription_id]
  );
}

module.exports = {
  createSubscription,
  getActiveSubscription,
  incrementListingsUsed,
};
