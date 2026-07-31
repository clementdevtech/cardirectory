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

    await query(`
      CREATE TABLE IF NOT EXISTS email_campaigns (
        id SERIAL PRIMARY KEY,
        created_by TEXT,
        type TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        recipients JSONB NOT NULL,
        batch_size INTEGER NOT NULL DEFAULT 10,
        interval_minutes INTEGER NOT NULL DEFAULT 5,
        current_batch INTEGER NOT NULL DEFAULT 0,
        total_recipients INTEGER NOT NULL DEFAULT 0,
        sent_count INTEGER NOT NULL DEFAULT 0,
        failed_count INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'scheduled',
        next_run_at TIMESTAMPTZ DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_error TEXT
      )
    `);

    await query(`
      ALTER TABLE email_campaigns
      ALTER COLUMN next_run_at DROP NOT NULL
    `);

    await query(`
      ALTER TABLE cars DROP CONSTRAINT IF EXISTS cars_status_check;
      ALTER TABLE cars
      ADD CONSTRAINT cars_status_check
      CHECK (status IN ('pending', 'active', 'removed', 'sold'))
    `);
  } catch (error) {
    console.error("❌ Failed to ensure sales commission schema:", error.message);
  }
}

module.exports = { ensureSalesCommissionSchema };
