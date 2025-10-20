import { query } from "../db";
import logger from "../logger";

export async function createPayment(payload: {
  dealer_id?: number | null;
  provider: string;
  method: string;
  amount: number;
  phone?: string;
  checkout_request_id?: string;
  raw_response?: any;
}) {
  const res = await query(
    `INSERT INTO payments (dealer_id, provider, method, amount, phone, checkout_request_id, raw_response)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
    [
      payload.dealer_id ?? null,
      payload.provider,
      payload.method,
      payload.amount,
      payload.phone ?? null,
      payload.checkout_request_id ?? null,
      payload.raw_response ?? null
    ]
  );
  logger.info("payment created", res.rows[0]);
  return res.rows[0];
}

export async function updatePaymentStatus(checkout_request_id: string, updates: Partial<Record<string, any>>) {
  const fields = Object.keys(updates);
  const values = Object.values(updates);
  const set = fields.map((f, i) => `${f} = $${i + 2}`).join(", ");
  const res = await query(
    `UPDATE payments SET ${set}, updated_at = now() WHERE checkout_request_id = $1 RETURNING *`,
    [checkout_request_id, ...values]
  );
  return res.rows[0];
}
