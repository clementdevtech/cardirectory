import { Request, Response, NextFunction } from "express";
import { getActiveSubscription } from "../models/subscriptions";

export async function requireActiveSubscription(req: Request, res: Response, next: NextFunction) {
  // expects req.body.dealer_id or req.query.dealer_id (adjust per auth)
  const dealerId = Number(req.body.dealer_id ?? req.query.dealer_id);
  if (!dealerId) return res.status(400).json({ error: "dealer_id required" });

  const sub = await getActiveSubscription(dealerId);
  if (!sub) return res.status(403).json({ error: "No active subscription" });

  if (sub.listings_used >= sub.listings_allowed) {
    return res.status(403).json({ error: "Listings limit reached. Please upgrade." });
  }
  // attach subscription to request
  (req as any).subscription = sub;
  next();
}