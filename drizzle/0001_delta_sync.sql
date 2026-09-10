-- Delta sync support.
--
-- Every synced table gets an updated_at column maintained by a trigger, and
-- deletions are logged so clients can poll "what changed since X" instead of
-- downloading the whole database every 30 seconds.
--
-- Additive and idempotent: safe to run more than once, never touches data.
-- Apply with:  psql "$DATABASE_URL" -f drizzle/0001_delta_sync.sql

CREATE OR REPLACE FUNCTION sync_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS sync_deletions (
  table_name text NOT NULL,
  row_id     text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (table_name, row_id)
);
CREATE INDEX IF NOT EXISTS sync_deletions_deleted_at_idx ON sync_deletions (deleted_at);

-- TG_ARGV[0] names the key column ("id" or "code").
CREATE OR REPLACE FUNCTION sync_log_deletion() RETURNS trigger AS $$
BEGIN
  INSERT INTO sync_deletions (table_name, row_id, deleted_at)
  VALUES (TG_TABLE_NAME, to_jsonb(OLD) ->> TG_ARGV[0], now())
  ON CONFLICT (table_name, row_id) DO UPDATE SET deleted_at = now();
  RETURN OLD;
END
$$ LANGUAGE plpgsql;

-- A row re-created after deletion (rooms are replaced wholesale on save)
-- must not still read as deleted.
CREATE OR REPLACE FUNCTION sync_clear_deletion() RETURNS trigger AS $$
BEGIN
  DELETE FROM sync_deletions
  WHERE table_name = TG_TABLE_NAME AND row_id = to_jsonb(NEW) ->> TG_ARGV[0];
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('bookings', 'id'),
      ('b2b_bookings', 'id'),
      ('rooms', 'id'),
      ('room_inventory', 'id'),
      ('venues', 'id'),
      ('venue_blocks', 'id'),
      ('bulk_room_blocks', 'id'),
      ('special_days', 'id'),
      ('credit_notes', 'code'),
      ('app_settings', 'id')
    ) AS v(name, key)
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now()', t.name);
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (updated_at)', t.name || '_updated_at_idx', t.name);
    EXECUTE format('DROP TRIGGER IF EXISTS sync_touch ON %I', t.name);
    EXECUTE format('CREATE TRIGGER sync_touch BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION sync_touch_updated_at()', t.name);
    EXECUTE format('DROP TRIGGER IF EXISTS sync_log_delete ON %I', t.name);
    EXECUTE format('CREATE TRIGGER sync_log_delete AFTER DELETE ON %I FOR EACH ROW EXECUTE FUNCTION sync_log_deletion(%L)', t.name, t.key);
    EXECUTE format('DROP TRIGGER IF EXISTS sync_clear_delete ON %I', t.name);
    EXECUTE format('CREATE TRIGGER sync_clear_delete BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION sync_clear_deletion(%L)', t.name, t.key);
  END LOOP;
END
$$;
