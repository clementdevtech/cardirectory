-- sql/schema.sql
-- DROP old tables if exist
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS dealers CASCADE;
DROP TABLE IF EXISTS users CASCADE; -- optional if you had users

-- dealers table (login/verification fields kept minimal)
CREATE TABLE dealers (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  country TEXT,
  national_id TEXT,
  kra_pin TEXT,
  verified BOOLEAN DEFAULT FALSE,
  verification_provider TEXT,
  verification_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- subscriptions table
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  dealer_id INTEGER REFERENCES dealers(id) ON DELETE CASCADE,
  plan_name TEXT NOT NULL,
  listings_allowed INTEGER NOT NULL,
  listings_used INTEGER DEFAULT 0,
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- payments table
CREATE TABLE payments (
  id SERIAL PRIMARY KEY,
  dealer_id INTEGER REFERENCES dealers(id) ON DELETE SET NULL,
  provider TEXT NOT NULL, -- mpesa / airtel
  method TEXT NOT NULL, -- e.g., stk_push
  amount NUMERIC(12,2) NOT NULL,
  currency TEXT DEFAULT 'KES',
  phone TEXT,
  status TEXT DEFAULT 'pending', -- pending, success, failed
  provider_reference TEXT,
  checkout_request_id TEXT,
  raw_response JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- add an index to speed queries for pending payments
CREATE INDEX idx_payments_checkout ON payments(checkout_request_id);
