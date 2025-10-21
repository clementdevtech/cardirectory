import { query } from "../db";
import logger from "../logger";
import { apiNinjas } from "../utils/validators";

export interface Dealer {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  verified?: boolean;
  verified_at?: string | null;
  created_at?: string | null;
}

/**
 * Create a new dealer row.
 * Returns the created dealer or null on failure.
 */
export async function createDealer(payload: {
  name: string;
  email: string;
  phone?: string | null;
  country?: string | null;
}): Promise<Dealer | null> {
  const { name, email, phone = null, country = null } = payload;

  const sql = `
    INSERT INTO dealers (name, email, phone, country, verified, created_at)
    VALUES ($1, $2, $3, $4, false, now())
    RETURNING id, name, email, phone, country, verified, verified_at, created_at
  `;

  try {
    const result = await query<Dealer>(sql, [name, email, phone, country]);
    return result.rows[0] ?? null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger?.error?.(`createDealer error: ${message}`);
    return null;
  }
}

/**
 * Get a dealer by id (UUID string).
 * Returns the dealer object or null if not found.
 */
export async function getDealerById(id: string): Promise<Dealer | null> {
  const sql = `
    SELECT id, name, email, phone, country, verified, verified_at, created_at
    FROM dealers
    WHERE id = $1
    LIMIT 1
  `;

  try {
    const result = await query<Dealer>(sql, [id]);
    return result.rows[0] ?? null;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger?.error?.(`getDealerById error (id=${id}): ${message}`);
    return null;
  }
}

/**
 * Mark a dealer as verified.
 * Returns true if the update succeeded, false otherwise.
 */
export async function setDealerVerified(id: string): Promise<boolean> {
  const sql = `
    UPDATE dealers
    SET verified = true,
        verified_at = now()
    WHERE id = $1
    RETURNING id
  `;

  try {
    const result = await query<{ id: string }>(sql, [id]);
    return (result.rowCount ?? result.rows.length) > 0;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    logger?.error?.(`setDealerVerified error (id=${id}): ${message}`);
    return false;
  }
}

export async function validateDealer(nationalId: string, kraPin: string) {
  try {
    const idValid = await apiNinjas.validateNationalID(nationalId);
    const kraValid = await apiNinjas.validateKRAPin(kraPin);

    if (!idValid || !kraValid) {
      return { success: false, message: "Validation failed" };
    }

    return { success: true, data: { nationalId: idValid, kraPin: kraValid } };
  } catch (error: any) {
    console.error("validateDealer error:", error);
    return { success: false, message: "Validation service unavailable" };
  }
}
