const { getActiveSubscription } = require("../models/subscriptions");

async function requireActiveSubscription(req, res, next) {
  // expects req.body.dealer_id or req.query.dealer_id (adjust per auth)
  const dealerId = Number(req.body?.dealer_id ?? req.query?.dealer_id);

  if (!dealerId) {
    return res.status(400).json({ error: "dealer_id required" });
  }

  const sub = await getActiveSubscription(dealerId);

  if (!sub) {
    return res.status(403).json({ error: "No active subscription" });
  }

  const listingLimit = Number(sub.listing_limit ?? 0);
  const currentListings = Number(sub.current_listings ?? 0);

  if (listingLimit > 0 && currentListings >= listingLimit) {
    return res.status(403).json({
      error: "Listings limit reached. Please upgrade.",
    });
  }

  req.subscription = sub;

  next();
}

module.exports = {
  requireActiveSubscription,
};
