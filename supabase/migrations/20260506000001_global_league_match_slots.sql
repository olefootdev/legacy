-- ═══════════════════════════════════════════════════════════════════════════
-- OLEFOOT — Liga Global: slots fixos por dia + conceito de "OleFoot day"
--
-- Etapa 2 da reorganização da Liga Global. Em vez de rodadas 24/7 a cada 5min,
-- as rodadas só podem acontecer DENTRO de janelas de slot (default 5/dia).
-- O dia OleFoot acompanha a UTC date atual.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE global_league_state
  ADD COLUMN IF NOT EXISTS match_slots JSONB
    DEFAULT '["05:30","11:00","15:00","19:00","21:30"]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS slot_duration_min INTEGER
    DEFAULT 30 NOT NULL,
  ADD COLUMN IF NOT EXISTS current_olefoot_day DATE
    DEFAULT CURRENT_DATE NOT NULL;

COMMENT ON COLUMN global_league_state.match_slots IS
  'Janelas (hh:mm UTC) onde rodadas podem ser disputadas. Default: 5 slots/dia.';
COMMENT ON COLUMN global_league_state.slot_duration_min IS
  'Duração de cada slot em minutos (default 30 = 6 rodadas de 5min).';
COMMENT ON COLUMN global_league_state.current_olefoot_day IS
  'Dia OleFoot atual (UTC). Atualizado pela Edge Function ao virar a meia-noite.';
