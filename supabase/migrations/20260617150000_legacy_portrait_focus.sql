-- =============================================================================
-- Foco/enquadramento do retrato dos jogadores Legacy (ponto focal).
-- Data: 2026-06-17
--
-- O admin cola a URL (Pinata) e ajusta o ENQUADRAMENTO sem re-subir imagem:
-- guarda foco X/Y (0..1) + zoom. Aplicado via CSS (object-position + scale) em
-- token, profile e card (market/transfer/legacies). Uma fonte de imagem só.
-- Default = 0.5 / 0.0 / 1 (espelha o object-top atual — sem mudar nada existente).
-- =============================================================================

alter table public.legacy_players
  add column if not exists portrait_focus_x real not null default 0.5,
  add column if not exists portrait_focus_y real not null default 0.0,
  add column if not exists portrait_zoom    real not null default 1.0;

-- Clamp defensivo (foco 0..1, zoom 1..3).
alter table public.legacy_players
  add constraint legacy_portrait_focus_x_chk check (portrait_focus_x between 0 and 1) not valid;
alter table public.legacy_players
  add constraint legacy_portrait_focus_y_chk check (portrait_focus_y between 0 and 1) not valid;
alter table public.legacy_players
  add constraint legacy_portrait_zoom_chk check (portrait_zoom between 0.5 and 3) not valid;
