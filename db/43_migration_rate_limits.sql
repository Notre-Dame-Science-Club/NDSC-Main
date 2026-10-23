-- Migration 43: shared (cross-instance) rate limiter
--
-- lib/api/rateLimitCore.ts keeps counters in process memory, which is meaningless on Vercel
-- (every instance has its own counters). checkRateLimitShared() in lib/api/rateLimit.ts calls
-- rate_limit_hit() below so all instances share one fixed-window counter per key.
--
-- Access is server-only: RLS is enabled with NO policies, and the function is executable by
-- service_role only. Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL
);
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;  -- no policies: only service role can touch it

CREATE OR REPLACE FUNCTION rate_limit_hit(p_key text, p_limit int, p_window_sec int)
RETURNS TABLE(ok boolean, retry_after_sec int)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_count int; v_reset timestamptz;
BEGIN
  INSERT INTO rate_limits AS r (key, count, reset_at)
  VALUES (p_key, 1, now() + make_interval(secs => p_window_sec))
  ON CONFLICT (key) DO UPDATE SET
    count   = CASE WHEN r.reset_at <= now() THEN 1 ELSE r.count + 1 END,
    reset_at = CASE WHEN r.reset_at <= now() THEN now() + make_interval(secs => p_window_sec) ELSE r.reset_at END
  RETURNING r.count, r.reset_at INTO v_count, v_reset;
  RETURN QUERY SELECT v_count <= p_limit,
                      GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_reset - now())))::int);
END $$;

REVOKE ALL ON FUNCTION rate_limit_hit(text,int,int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION rate_limit_hit(text,int,int) TO service_role;

-- housekeeping (run occasionally or via pg_cron): DELETE FROM rate_limits WHERE reset_at < now() - interval '1 day';
