-- Run once on the existing database. These columns preserve sales attribution.
ALTER TABLE dealers ADD COLUMN IF NOT EXISTS registered_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE cars ADD COLUMN IF NOT EXISTS assisted_by UUID REFERENCES users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_dealers_registered_by ON dealers(registered_by);
CREATE INDEX IF NOT EXISTS idx_cars_assisted_by ON cars(assisted_by);

ALTER TABLE cars DROP CONSTRAINT IF EXISTS cars_status_check;
ALTER TABLE cars ADD CONSTRAINT cars_status_check
	CHECK (status IN ('pending', 'active', 'removed', 'sold'));
