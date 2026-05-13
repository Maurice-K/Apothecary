-- Per-IP rate limiting for the nutritionist Edge Function.
-- Single table + atomic RPC. Service role only (RLS denies clients).

CREATE TABLE nutritionist_rate_limits (
  ip TEXT PRIMARY KEY,
  minute_window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  minute_count INT NOT NULL DEFAULT 0,
  day_window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  day_count INT NOT NULL DEFAULT 0,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE nutritionist_rate_limits ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (Edge Function) reads/writes this table.

CREATE OR REPLACE FUNCTION check_nutritionist_rate_limit(
  client_ip TEXT,
  minute_limit INT DEFAULT 5,
  day_limit INT DEFAULT 30
)
RETURNS TABLE (
  allowed BOOLEAN,
  minute_remaining INT,
  day_remaining INT,
  retry_after_seconds INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  now_ts TIMESTAMPTZ := NOW();
  rl nutritionist_rate_limits%ROWTYPE;
  minute_age INT;
  day_age INT;
  minute_retry INT;
  day_retry INT;
  computed_retry INT;
BEGIN
  -- Upsert + lock the row for this IP. ON CONFLICT DO UPDATE acquires a row lock
  -- held for the duration of this function call, serializing concurrent requests.
  INSERT INTO nutritionist_rate_limits (ip)
    VALUES (client_ip)
    ON CONFLICT (ip) DO UPDATE SET last_seen_at = now_ts
    RETURNING * INTO rl;

  -- Reset minute window if expired.
  minute_age := EXTRACT(EPOCH FROM (now_ts - rl.minute_window_start))::INT;
  IF minute_age >= 60 THEN
    rl.minute_count := 0;
    rl.minute_window_start := now_ts;
    minute_age := 0;
  END IF;

  -- Reset day window if expired.
  day_age := EXTRACT(EPOCH FROM (now_ts - rl.day_window_start))::INT;
  IF day_age >= 86400 THEN
    rl.day_count := 0;
    rl.day_window_start := now_ts;
    day_age := 0;
  END IF;

  IF rl.minute_count >= minute_limit OR rl.day_count >= day_limit THEN
    -- retry_after = seconds until the BINDING constraint resets.
    minute_retry := GREATEST(0, 60 - minute_age);
    day_retry := GREATEST(0, 86400 - day_age);
    IF rl.minute_count >= minute_limit AND rl.day_count < day_limit THEN
      computed_retry := minute_retry;
    ELSIF rl.day_count >= day_limit AND rl.minute_count < minute_limit THEN
      computed_retry := day_retry;
    ELSE
      computed_retry := GREATEST(minute_retry, day_retry);
    END IF;

    -- Persist any window resets without incrementing counts.
    UPDATE nutritionist_rate_limits
      SET minute_window_start = rl.minute_window_start,
          minute_count = rl.minute_count,
          day_window_start = rl.day_window_start,
          day_count = rl.day_count,
          last_seen_at = now_ts
      WHERE ip = client_ip;

    RETURN QUERY SELECT
      FALSE,
      GREATEST(0, minute_limit - rl.minute_count),
      GREATEST(0, day_limit - rl.day_count),
      computed_retry;
    RETURN;
  END IF;

  -- Within limits: increment both counters.
  rl.minute_count := rl.minute_count + 1;
  rl.day_count := rl.day_count + 1;

  UPDATE nutritionist_rate_limits
    SET minute_window_start = rl.minute_window_start,
        minute_count = rl.minute_count,
        day_window_start = rl.day_window_start,
        day_count = rl.day_count,
        last_seen_at = now_ts
    WHERE ip = client_ip;

  RETURN QUERY SELECT
    TRUE,
    minute_limit - rl.minute_count,
    day_limit - rl.day_count,
    0;
END;
$$;

GRANT EXECUTE ON FUNCTION check_nutritionist_rate_limit(TEXT, INT, INT) TO service_role;
