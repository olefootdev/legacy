-- ═══════════════════════════════════════════════════════════════════════
--  OLEFOOT PYTHON MODE — Schema for impact + engagement systems
--  Sistema A: club_consequences (persistent overlay effects)
--  Sistema E: manager_presence + manager_login_bonus_claims
--  Will be consumed by:
--    - TS reducer (real-time overlay)
--    - Python /insights service (analytics, batch jobs)
-- ═══════════════════════════════════════════════════════════════════════

-- ─── Sistema A: PersistentConsequence storage ─────────────────────────
CREATE TABLE IF NOT EXISTS public.club_consequences (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id      uuid NOT NULL,
  club_id         text NOT NULL,
  player_id       text,
  kind            text NOT NULL,
  dimension       text NOT NULL CHECK (dimension IN ('physical','psychological','reputational','financial')),
  scope           text NOT NULL CHECK (scope IN ('player','club')),
  magnitude       numeric NOT NULL,
  decay_curve     text NOT NULL DEFAULT 'linear' CHECK (decay_curve IN ('step','linear','exponential')),
  starts_at       timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL,
  source_event_id text,
  metadata        jsonb DEFAULT '{}'::jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_club_consequences_manager_expires
  ON public.club_consequences (manager_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_club_consequences_player_expires
  ON public.club_consequences (player_id, expires_at)
  WHERE player_id IS NOT NULL;

-- Postgres não aceita now() em predicate de index (não é IMMUTABLE).
-- Index sem WHERE: queries de "consequências ativas por dimensão" continuam
-- usando este index + filtro WHERE expires_at > now() no runtime.
CREATE INDEX IF NOT EXISTS idx_club_consequences_dimension_expires
  ON public.club_consequences (dimension, expires_at);

COMMENT ON TABLE public.club_consequences IS
  'Persistent overlay effects with temporal decay. TS reducer applies overlay; Python /insights aggregates for projections.';

-- RLS: manager só lê/escreve as próprias consequências
ALTER TABLE public.club_consequences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "consequences_select_own" ON public.club_consequences;
CREATE POLICY "consequences_select_own"
  ON public.club_consequences FOR SELECT
  USING (auth.uid() = manager_id);

DROP POLICY IF EXISTS "consequences_insert_own" ON public.club_consequences;
CREATE POLICY "consequences_insert_own"
  ON public.club_consequences FOR INSERT
  WITH CHECK (auth.uid() = manager_id);

DROP POLICY IF EXISTS "consequences_update_own" ON public.club_consequences;
CREATE POLICY "consequences_update_own"
  ON public.club_consequences FOR UPDATE
  USING (auth.uid() = manager_id);

DROP POLICY IF EXISTS "consequences_delete_own" ON public.club_consequences;
CREATE POLICY "consequences_delete_own"
  ON public.club_consequences FOR DELETE
  USING (auth.uid() = manager_id);


-- ─── Sistema E: Manager presence (engagement tracking) ────────────────
CREATE TABLE IF NOT EXISTS public.manager_presence (
  manager_id                      uuid PRIMARY KEY,
  last_login_at                   timestamptz NOT NULL,
  last_session_end_at             timestamptz,
  total_sessions                  integer NOT NULL DEFAULT 0,
  last_bonus_claim_at             timestamptz,
  bonus_streak_slots              integer NOT NULL DEFAULT 0,
  absence_penalty_last_applied_at timestamptz,
  last_absence_tier               text CHECK (last_absence_tier IN
    ('normal','warning_12h','mild_24h','moderate_36h','heavy_48h','crisis_72h')),
  updated_at                      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_manager_presence_last_login
  ON public.manager_presence (last_login_at);

COMMENT ON TABLE public.manager_presence IS
  'Tracks manager presence for absence penalty + login bonus cycle.';

ALTER TABLE public.manager_presence ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "presence_select_own" ON public.manager_presence;
CREATE POLICY "presence_select_own"
  ON public.manager_presence FOR SELECT
  USING (auth.uid() = manager_id);

DROP POLICY IF EXISTS "presence_upsert_own" ON public.manager_presence;
CREATE POLICY "presence_upsert_own"
  ON public.manager_presence FOR INSERT
  WITH CHECK (auth.uid() = manager_id);

DROP POLICY IF EXISTS "presence_update_own" ON public.manager_presence;
CREATE POLICY "presence_update_own"
  ON public.manager_presence FOR UPDATE
  USING (auth.uid() = manager_id);


-- ─── Sistema E: Login bonus claim history ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.manager_login_bonus_claims (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id   uuid NOT NULL,
  claimed_at   timestamptz NOT NULL DEFAULT now(),
  slot_index   integer NOT NULL,
  reward_kind  text NOT NULL,
  exp_granted  integer,
  is_weekend   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_login_bonus_claims_manager_at
  ON public.manager_login_bonus_claims (manager_id, claimed_at DESC);

COMMENT ON TABLE public.manager_login_bonus_claims IS
  'History of 3h/1h cycle bonus claims. Used for streak preservation and analytics.';

ALTER TABLE public.manager_login_bonus_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bonus_claims_select_own" ON public.manager_login_bonus_claims;
CREATE POLICY "bonus_claims_select_own"
  ON public.manager_login_bonus_claims FOR SELECT
  USING (auth.uid() = manager_id);

DROP POLICY IF EXISTS "bonus_claims_insert_own" ON public.manager_login_bonus_claims;
CREATE POLICY "bonus_claims_insert_own"
  ON public.manager_login_bonus_claims FOR INSERT
  WITH CHECK (auth.uid() = manager_id);
