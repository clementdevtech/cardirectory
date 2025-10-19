import express from "express";
import { updatePaymentStatus } from "../models/payments";
import { createSubscription } from "../models/subscriptions";
import { log } from "../logger";
const router = express.Router();

/**
 * M-Pesa callback handler
 * Safaricom will POST STK Push result to this endpoint
 */
router.post("/mpesa", async (req, res) => {
  try {
    const body = req.body;
    log.info("mpesa webhook:", JSON.stringify(body).slice(0, 400));
    // Daraja returns different shapes — sample shape:
    // body.Body.stkCallback with CheckoutRequestID and ResultCode
    const callback = body?.Body?.stkCallback;
    if (!callback) {
      // respond ok
      return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
    }

    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;
    // Update payment with CheckoutRequestID
    await updatePaymentStatus(CheckoutRequestID, {
      status: ResultCode === 0 ? "success" : "failed",
      provider_reference: ResultCode === 0 ? (CallbackMetadata?.Item?.find((i: any)=> i.Name === 'MpesaReceiptNumber')?.Value || null) : null,
      raw_response: callback
    });

    // On success, create subscription record: find dealer & plan mapping — simplified example
    if (ResultCode === 0) {
      // You should look up the payment (by CheckoutRequestID) to find dealer_id and amount/plan sent.
      // For demo: query payments table or pass accountref in original STK push.
      // Here we leave it to your integration.
      // Example:
      // const payment = await findPaymentByCheckout(CheckoutRequestID)
      // await createSubscription({ dealer_id: payment.dealer_id, plan_name: 'Standard', listings_allowed: 5, duration_days: 30 });
    }

    // Respond quickly
    return res.json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (err: any) {
    log.error("mpesa webhook error", err?.message || err);
    return res.status(500).json({ error: "server error" });
  }
});

/**
 * Airtel callback
 * This depends on Airtel provider shape
 */
router.post("/airtel", async (req, res) => {
  console.log("airtel webhook", req.body);
  res.json({ ok: true });
});

export default router;
