const { query } = require("../db");
const logger = require("../logger");
const { apiNinjas } = require("../utils/validators");

/**
 * Create a new dealer row.
 * Returns the created dealer or null on failure.
 */
async function createDealer(payload) {
  const { name, email, phone = null, country = null } = payload;

  const sql = `
    INSERT INTO dealers (name, email, phone, country, verified, created_at)
    VALUES ($1, $2, $3, $4, false, now())
    RETURNING id, name, email, phone, country, verified, verified_at, created_at
  `;

  try {
    const result = await query(sql, [name, email, phone, country]);
    return result.rows[0] ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger?.error?.(`createDealer error: ${message}`);
    return null;
  }
}

/**
 * Get a dealer by id (UUID string).
 * Returns the dealer object or null if not found.
 */
async function getDealerById(id) {
  const sql = `
    SELECT id, name, email, phone, country, verified, verified_at, created_at
    FROM dealers
    WHERE id = $1
    LIMIT 1
  `;

  try {
    const result = await query(sql, [id]);
    return result.rows[0] ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger?.error?.(`getDealerById error (id=${id}): ${message}`);
    return null;
  }
}

/**
 * Mark a dealer as verified.
 * Returns true if the update succeeded, false otherwise.
 */
async function setDealerVerified(id) {
  const sql = `
    UPDATE dealers
    SET verified = true,
        verified_at = now()
    WHERE id = $1
    RETURNING id
  `;

  try {
    const result = await query(sql, [id]);
    return (result.rowCount ?? result.rows.length) > 0;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger?.error?.(`setDealerVerified error (id=${id}): ${message}`);
    return false;
  }
}

async function validateDealer(nationalId, kraPin) {
  try {
    const idValid = await apiNinjas.validateNationalID(nationalId);
    const kraValid = await apiNinjas.validateKRAPin(kraPin);

    if (!idValid || !kraValid) {
      return { success: false, message: "Validation failed" };
    }

    return {
      success: true,
      data: { nationalId: idValid, kraPin: kraValid },
    };
  } catch (error) {
    console.error("validateDealer error:", error);
    return {
      success: false,
      message: "Validation service unavailable",
    };
  }
}

module.exports = {
  createDealer,
  getDealerById,
  setDealerVerified,
  validateDealer,
};
