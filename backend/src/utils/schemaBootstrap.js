const { query } = require("../db");

async function ensureSalesCommissionSchema() {
  try {
    await query(`
      CREATE TABLE IF NOT EXISTS sales_commissions (
        id BIGSERIAL PRIMARY KEY,
        salesperson_id UUID,
        dealer_id UUID,
        payment_id TEXT UNIQUE,
        package_name TEXT,
        package_amount NUMERIC(12,2) DEFAULT 0,
        commission_rate NUMERIC(5,2) DEFAULT 15.00,
        commission_amount NUMERIC(12,2) DEFAULT 0,
        status TEXT DEFAULT 'pending',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        paid_at TIMESTAMPTZ
      )
    `);

    await query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,2) DEFAULT 15.00
    `);

    await query(`
      ALTER TABLE dealers
      ADD COLUMN IF NOT EXISTS referred_by UUID
    `);

    await query(`
      ALTER TABLE dealers
      ADD COLUMN IF NOT EXISTS sales_commission_rate NUMERIC(5,2) DEFAULT 15.00
    `);
  } catch (error) {
    console.error("❌ Failed to ensure sales commission schema:", error.message);
  }
}

module.exports = { ensureSalesCommissionSchema };
