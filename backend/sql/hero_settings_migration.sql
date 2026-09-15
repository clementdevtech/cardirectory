-- Hero media settings managed from the admin dashboard.
CREATE TABLE IF NOT EXISTS site_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  hero_image_url TEXT,
  hero_video_url TEXT,
  hero_video_url_2 TEXT,
  hero_video_duration_seconds INTEGER NOT NULL DEFAULT 8,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT site_settings_singleton CHECK (id = 1)
);

INSERT INTO site_settings (id, hero_image_url, hero_video_url, hero_video_duration_seconds)
VALUES (1, NULL, NULL, 8)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE site_settings
  ADD COLUMN IF NOT EXISTS hero_video_url_2 TEXT;
