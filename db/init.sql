CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS categories (
  id text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  label text NOT NULL UNIQUE,
  emoji text NOT NULL DEFAULT '📍',
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO categories (id, label, emoji, sort_order)
VALUES
  ('meal', '맛집', '🍽️', 10),
  ('dessert', '디저트', '🍰', 20),
  ('sightseeing', '관광', '🗼', 30)
ON CONFLICT (id) DO UPDATE
SET
  label = EXCLUDED.label,
  emoji = EXCLUDED.emoji,
  sort_order = EXCLUDED.sort_order;

CREATE TABLE IF NOT EXISTS restaurants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  cuisine text NOT NULL,
  menu text NOT NULL,
  description text NOT NULL,
  google_maps_note text,
  address text NOT NULL,
  google_maps_url text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  travel_mode text NOT NULL CHECK (travel_mode IN ('walk', 'transit')),
  travel_minutes integer NOT NULL CHECK (travel_minutes >= 0),
  distance_label text NOT NULL,
  place_status text NOT NULL DEFAULT 'active' CHECK (place_status IN ('active', 'deleted')),
  google_sync_key text,
  google_sync_source_url text,
  google_synced_at timestamptz,
  photos_cached_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS photos_cached_at timestamptz;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS place_status text NOT NULL DEFAULT 'active';
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS google_sync_key text;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS google_sync_source_url text;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS google_synced_at timestamptz;
ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS google_maps_note text;
ALTER TABLE restaurants DROP COLUMN IF EXISTS no_seafood;

UPDATE restaurants
SET google_maps_note = btrim(replace(split_part(description, E'\n', 1), 'Google Maps 메모:', ''))
WHERE (google_maps_note IS NULL OR btrim(google_maps_note) = '')
  AND description LIKE 'Google Maps 메모:%';

UPDATE restaurants
SET description = btrim(regexp_replace(description, '^Google Maps 메모:.*(\r?\n)?', ''))
WHERE description LIKE 'Google Maps 메모:%';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'restaurants'::regclass
      AND conname = 'restaurants_place_status_check'
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_place_status_check
      CHECK (place_status IN ('active', 'deleted'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS restaurant_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  source_photo_name text NOT NULL,
  content_type text NOT NULL DEFAULT 'image/jpeg',
  image_bytes bytea NOT NULL,
  width_px integer,
  height_px integer,
  author_name text,
  author_uri text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (restaurant_id, source_photo_name)
);

CREATE TABLE IF NOT EXISTS schedule_days (
  id text PRIMARY KEY,
  sort_order integer NOT NULL,
  selected_return_route_mode text CHECK (selected_return_route_mode IN ('driving', 'transit', 'walking')),
  departure_time_minutes integer CHECK (departure_time_minutes >= 0 AND departure_time_minutes < 1440 AND departure_time_minutes % 30 = 0),
  travel_date date,
  hotel_place_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  locked_return_route boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS selected_return_route_mode text;
ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS hotel_place_id uuid REFERENCES restaurants(id) ON DELETE SET NULL;
ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS departure_time_minutes integer;
ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS travel_date date;
ALTER TABLE schedule_days ADD COLUMN IF NOT EXISTS locked_return_route boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'schedule_days'::regclass
      AND conname = 'schedule_days_selected_return_route_mode_check'
  ) THEN
    ALTER TABLE schedule_days
      ADD CONSTRAINT schedule_days_selected_return_route_mode_check
      CHECK (selected_return_route_mode IN ('driving', 'transit', 'walking'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS schedule_stops (
  id text PRIMARY KEY,
  day_id text NOT NULL REFERENCES schedule_days(id) ON DELETE CASCADE,
  restaurant_id uuid NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  selected_route_mode text CHECK (selected_route_mode IN ('driving', 'transit', 'walking')),
  departure_time_minutes integer CHECK (departure_time_minutes >= 0 AND departure_time_minutes < 1440 AND departure_time_minutes % 30 = 0),
  locked_from_previous boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (day_id, restaurant_id),
  UNIQUE (day_id, sort_order)
);

ALTER TABLE schedule_stops ADD COLUMN IF NOT EXISTS selected_route_mode text;
ALTER TABLE schedule_stops ADD COLUMN IF NOT EXISTS departure_time_minutes integer;
ALTER TABLE schedule_stops ADD COLUMN IF NOT EXISTS locked_from_previous boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'schedule_stops'::regclass
      AND conname = 'schedule_stops_selected_route_mode_check'
  ) THEN
    ALTER TABLE schedule_stops
      ADD CONSTRAINT schedule_stops_selected_route_mode_check
      CHECK (selected_route_mode IN ('driving', 'transit', 'walking'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS route_cache_entries (
  from_place_key text NOT NULL,
  to_place_key text NOT NULL,
  calculation_version integer NOT NULL DEFAULT 1,
  driving_status text CHECK (driving_status IN ('ready', 'estimated', 'error')),
  driving_duration_label text,
  driving_distance_label text,
  driving_error text,
  driving_updated_at timestamptz,
  transit_status text CHECK (transit_status IN ('ready', 'estimated', 'error')),
  transit_duration_label text,
  transit_distance_label text,
  transit_error text,
  transit_updated_at timestamptz,
  walking_status text CHECK (walking_status IN ('ready', 'estimated', 'error')),
  walking_duration_label text,
  walking_distance_label text,
  walking_error text,
  walking_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_place_key, to_place_key),
  CHECK (from_place_key <> to_place_key)
);

ALTER TABLE route_cache_entries ALTER COLUMN driving_status DROP NOT NULL;
ALTER TABLE route_cache_entries ALTER COLUMN driving_duration_label DROP NOT NULL;
ALTER TABLE route_cache_entries ALTER COLUMN driving_distance_label DROP NOT NULL;
ALTER TABLE route_cache_entries ALTER COLUMN transit_status DROP NOT NULL;
ALTER TABLE route_cache_entries ALTER COLUMN transit_duration_label DROP NOT NULL;
ALTER TABLE route_cache_entries ALTER COLUMN transit_distance_label DROP NOT NULL;
ALTER TABLE route_cache_entries ALTER COLUMN walking_status DROP NOT NULL;
ALTER TABLE route_cache_entries ALTER COLUMN walking_duration_label DROP NOT NULL;
ALTER TABLE route_cache_entries ALTER COLUMN walking_distance_label DROP NOT NULL;
ALTER TABLE route_cache_entries ADD COLUMN IF NOT EXISTS driving_updated_at timestamptz;
ALTER TABLE route_cache_entries ADD COLUMN IF NOT EXISTS transit_updated_at timestamptz;
ALTER TABLE route_cache_entries ADD COLUMN IF NOT EXISTS walking_updated_at timestamptz;

CREATE TABLE IF NOT EXISTS app_auth (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  password_hash text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_users (
  username text PRIMARY KEY,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  token text PRIMARY KEY,
  username text NOT NULL REFERENCES app_users(username) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

ALTER TABLE auth_sessions ADD COLUMN IF NOT EXISTS username text REFERENCES app_users(username) ON DELETE CASCADE;

CREATE TABLE IF NOT EXISTS reservations (
  id text PRIMARY KEY,
  reservation_type text NOT NULL CHECK (reservation_type IN ('restaurant', 'ticket', 'transport', 'hotel', 'other')),
  title text NOT NULL,
  day_index integer,
  place_id uuid REFERENCES restaurants(id) ON DELETE SET NULL,
  time_label text NOT NULL DEFAULT '',
  booking_platform text NOT NULL DEFAULT '',
  reference_number text NOT NULL DEFAULT '',
  link_url text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS attachments jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS completed boolean NOT NULL DEFAULT false;
ALTER TABLE reservations ADD COLUMN IF NOT EXISTS booking_platform text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS api_usage_daily (
  usage_date date NOT NULL,
  service_id text NOT NULL,
  service_name text NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  cache_hit_count integer NOT NULL DEFAULT 0 CHECK (cache_hit_count >= 0),
  cache_miss_count integer NOT NULL DEFAULT 0 CHECK (cache_miss_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (usage_date, service_id)
);

ALTER TABLE api_usage_daily ADD COLUMN IF NOT EXISTS cache_hit_count integer NOT NULL DEFAULT 0;
ALTER TABLE api_usage_daily ADD COLUMN IF NOT EXISTS cache_miss_count integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS api_usage_limits (
  service_id text PRIMARY KEY,
  service_name text NOT NULL,
  daily_limit integer NOT NULL CHECK (daily_limit > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'restaurants'::regclass
      AND conname = 'restaurants_category_check'
  ) THEN
    ALTER TABLE restaurants DROP CONSTRAINT restaurants_category_check;
  END IF;
END $$;

INSERT INTO categories (id, label, emoji, sort_order)
SELECT DISTINCT category, category, '📍', 100
FROM restaurants
WHERE category NOT IN (SELECT id FROM categories)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'restaurants'::regclass
      AND conname = 'restaurants_category_fk'
  ) THEN
    ALTER TABLE restaurants
      ADD CONSTRAINT restaurants_category_fk
      FOREIGN KEY (category) REFERENCES categories(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS restaurants_category_idx ON restaurants (category);
CREATE INDEX IF NOT EXISTS restaurants_travel_mode_idx ON restaurants (travel_mode);
CREATE INDEX IF NOT EXISTS restaurants_place_status_idx ON restaurants (place_status);
CREATE UNIQUE INDEX IF NOT EXISTS restaurants_google_sync_key_idx
  ON restaurants (google_sync_key)
  WHERE google_sync_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS restaurant_photos_restaurant_idx ON restaurant_photos (restaurant_id, sort_order);
CREATE INDEX IF NOT EXISTS auth_sessions_expires_at_idx ON auth_sessions (expires_at);
CREATE INDEX IF NOT EXISTS auth_sessions_username_idx ON auth_sessions (username);
CREATE INDEX IF NOT EXISTS categories_sort_order_idx ON categories (sort_order, label);
CREATE INDEX IF NOT EXISTS schedule_days_sort_order_idx ON schedule_days (sort_order);
CREATE INDEX IF NOT EXISTS schedule_stops_day_sort_order_idx ON schedule_stops (day_id, sort_order);
CREATE INDEX IF NOT EXISTS route_cache_entries_updated_at_idx ON route_cache_entries (updated_at);
CREATE INDEX IF NOT EXISTS reservations_day_sort_order_idx ON reservations (day_index, sort_order);
CREATE INDEX IF NOT EXISTS reservations_place_idx ON reservations (place_id);
